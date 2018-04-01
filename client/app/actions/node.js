
import fetchJSON from '../utils/fetch'
import { normalize, Schema, arrayOf } from 'normalizr'
import Schemas from '../schemas'
import { CALL_API } from '../middleware/api'

import {
    getNode,
    getSlateDocument,
} from '../reducers'
import {
    getEdge,
} from '../reducers'

const uuidV4 = require('uuid/v4');

/*
 * Push a new delta
 */
export const PUSH_DELTA = "PUSH_DELTA"
export function pushDelta(parentNodeId, change) {

    return (dispatch, getState) => {

        // const slateDocument = getSlateDocument(getState())
        const slateDocument = change.value.document
        const operations = change.operations.toJS()
        const opTypes = operations.map(op => op.type)

        let delta;

        // TODO: need document here - 2018-03-29

        // console.log(change.value.history.toJSON());
        console.log(operations);

        // TODO: check if it is reverse of last change, if so: undo - 2018-03-29
        // TODO: merge ops if not synced yet for "insert_text" and "remove_text" - 2018-03-29

        if (_.isEqual(opTypes, [ "split_node", "split_node", "insert_node", "move_node", "set_selection" ])) {
            // insertion of an inline node
            const nodeType = operations[2].node.type

            const parentNode = slateDocument.getNodeAtPath(operations[0].path.slice(0, operations[0].path.length-1))

            switch(nodeType) {
                case "link": {
                    // inserting a link
                    delta = {
                        type: "insert_inline",
                        nodeType: "link",
                        nodeId: parentNode.data.id, // id of the paragraph
                        data: operations[2].data,
                        start: operations[1].position,
                        end: operations[0].position,
                    }
                }
                default: {
                    console.error("tried to insert unknown inline node", nodeType)
                    return;
                }
            }
        }
        else if (operations[0].type === "split_node") {
            delta = {
                type: "split_node",
                path: operations[1].path, // only an internal value
                nodeId: operations[1].properties.data.id, // TODO: need the unique node key here
                offset: operations[1].target, // where in the text???
            }
        }
        else if (operations[0].type === "insert_text") {
            // typing characters

            const op = operations[0]

            const parentNode = slateDocument.getNodeAtPath(op.path.slice(0, op.path.length-1))
            delta = {
                type: "insert_text",
                nodeType: "text",
                nodeId: parentNode.data.id,
                offset: op.offset, // where in the text???
                value: op.text,
            }
        }
        else if (operations[1] && operations[1].type === "remove_text") {
            // TODO: merge if possible - 2018-03-28
            const op = operations[1]

            const parentNode = slateDocument.getNodeAtPath(op.path.slice(0, op.path.length-1))
            delta = {
                type: "insert_text",
                nodeType: "text",
                nodeId: parentNode.data.id,
                offset: op.offset, // where in the text???
                value: op.text,
            }
        }
        else {
            // else just iterate over the operations and add the low-level operations to the history 
            console.error("unhandled change delta", operations)

            const newOps = operations.reduce((filteredOps, op) => {
                switch(op.type) {
                        // TODO: merge ops if not synced yet - 2018-03-29
                    case "insert_text": {
                        const parentNode = slateDocument.getNodeAtPath(op.path.slice(0, op.path.length-1))
                        filteredOps.push({
                            type: "insert_text",
                            nodeType: "text",
                            nodeId: parentNode.data.id,
                            offset: op.offset, // where in the text???
                            value: op.text,
                        })
                        return filteredOps
                    }
                        // TODO: merge ops if not synced yet - 2018-03-29
                    case "remove_text": {
                        const parentNode = slateDocument.getNodeAtPath(op.path.slice(0, op.path.length-1))
                        filteredOps.push({
                            type: "remove_text",
                            nodeType: "text",
                            nodeId: parentNode.data.id,
                            offset: op.offset, // where in the text???
                        })
                        return filteredOps
                    }

                    case "add_mark": {
                        filteredOps.push({
                            type: "add_mark",
                            nodeType: op.properties.type || "text",
                            nodeId: op.properties.type ? op.properties.data.id : null,
                            offset: op.offset, // where in the text???
                            value: op.text,
                        })
                        return filteredOps
                    }
                    default: {
                        return filteredOps
                    }
                }
            }, [])


            const delta = {
                type: "unknown",
                operations: ops

            }
        }

        return dispatch({
            type: PUSH_DELTA,
            nodeId: parentNodeId,
            delta,
            slateChange: change,
        })
    }
}
/*
 * Revert a delta to the delta with id ${id}
 * if the delta is already synced, push the reverse operations, otherwise pop and sync.
 */
export const REVERT_DELTA = "REVERT_DELTA"
export function revertDelta(deltaId) {
    return {
        deltaId
    }
}


/*
 * Get a node by id
 */
export const GET_NODE_REQUEST = 'GET_NODE_REQUEST'
export const GET_NODE_SUCCESS = 'GET_NODE_SUCCESS'
export const GET_NODE_FAILURE = 'GET_NODE_FAILURE'
export function fetchNode(id) {
    return {
        [CALL_API]: {
            types: [ GET_NODE_REQUEST, GET_NODE_SUCCESS, GET_NODE_FAILURE ],
            endpoint: 'Node.get',
            payload: [ id ],
            schema: {
                node: Schemas.NODE,
                collections: arrayOf(Schemas.COLLECTION),
            },
        }
    }
}
// TODO: not used right now - 2017-08-25
export function loadNode(id, refresh=true) {
    return (dispatch, getState) => {
        const node = getNode(getState())

        if (node && !refresh) {
            return null
        }

        return dispatch(fetchNode(id))
    }
}


/*
 * Get a node by id including its neighbours and the connections between them
 */
export const GET_NODE_L1_REQUEST = 'GET_NODE_L1_REQUEST'
export const GET_NODE_L1_SUCCESS = 'GET_NODE_L1_SUCCESS'
export const GET_NODE_L1_FAILURE = 'GET_NODE_L1_FAILURE'
export function fetchNodeL1(id) {
    return {
        id,
        [CALL_API]: {
            types: [ GET_NODE_L1_REQUEST, GET_NODE_L1_SUCCESS, GET_NODE_L1_FAILURE ],
            endpoint: 'Node.getL1',
            payload: [ id ],
            schema: {
                node: Schemas.NODE,
                connectedNodes: arrayOf(Schemas.NODE),
                edges: arrayOf(Schemas.EDGE),
                collections: arrayOf(Schemas.NODE),
            },
        }
    }
}
export function loadNodeL1(id, collectionId) {
    return (dispatch, getState) => {
        return dispatch(fetchNodeL1(id, collectionId))
    }
}

/*
 * Get a node by id including its neighbours and the connections between them
 */
export const GET_NODE_L2_REQUEST = 'GET_NODE_L2_REQUEST'
export const GET_NODE_L2_SUCCESS = 'GET_NODE_L2_SUCCESS'
export const GET_NODE_L2_FAILURE = 'GET_NODE_L2_FAILURE'
export function fetchNodeL2(id) {
    return {
        [CALL_API]: {
            types: [ GET_NODE_L2_REQUEST, GET_NODE_L2_SUCCESS, GET_NODE_L2_FAILURE ],
            endpoint: 'Node.getL2',
            payload: [ id ],
            schema: {
                node: Schemas.NODE,
                connectedNodes: arrayOf(Schemas.NODE),
                edges: arrayOf(Schemas.EDGE),
            },
        }
    }
}
export function loadNodeL2(id, refresh=true) {
    return (dispatch, getState) => {
        return dispatch(fetchNodeL2(id))
    }
}


/*
 * Create a node
 */
export const CREATE_NODE_REQUEST = 'CREATE_NODE_REQUEST'
export const CREATE_NODE_SUCCESS = 'CREATE_NODE_SUCCESS'
export const CREATE_NODE_FAILURE = 'CREATE_NODE_FAILURE'
export function createNode(node) {
    const id = uuidV4()

    return {
        id,
        [CALL_API]: {
            types: [ CREATE_NODE_REQUEST, CREATE_NODE_SUCCESS, CREATE_NODE_FAILURE ],
            endpoint: 'Node.create',
            payload: [ id, node ],
            schema: Schemas.NODE
        }
    }
}

/*
 * Update a node, without changing relations
 */
export const UPDATE_NODE_REQUEST = 'UPDATE_NODE_REQUEST'
export const UPDATE_NODE_SUCCESS = 'UPDATE_NODE_SUCCESS'
export const UPDATE_NODE_FAILURE = 'UPDATE_NODE_FAILURE'
export function updateNode(id, properties) {
    return {
        id,
        [CALL_API]: {
            types: [ UPDATE_NODE_REQUEST, UPDATE_NODE_SUCCESS, UPDATE_NODE_FAILURE ],
            endpoint: 'Node.update',
            payload: [ id, properties ],
            schema: Schemas.NODE
        }
    }
}

/*
 * Remove a node detaching it from all neighbours
 */
export const REMOVE_NODE_REQUEST = 'REMOVE_NODE_REQUEST'
export const REMOVE_NODE_SUCCESS = 'REMOVE_NODE_SUCCESS'
export const REMOVE_NODE_FAILURE = 'REMOVE_NODE_FAILURE'
export function removeNode(nodeId) {
    return {
        nodeId,
        [CALL_API]: {
            types: [ REMOVE_NODE_REQUEST, REMOVE_NODE_SUCCESS, REMOVE_NODE_FAILURE ],
            endpoint: 'Node.remove',
            payload: [ nodeId ],
            // schema: Schemas.NODE
        }
    }
}



/*
 * Connect the two nodes (can be of type Node and Collection)
 */
export const CONNECT_NODES_REQUEST = 'CONNECT_NODES_REQUEST'
export const CONNECT_NODES_SUCCESS = 'CONNECT_NODES_SUCCESS'
export const CONNECT_NODES_FAILURE = 'CONNECT_NODES_FAILURE'
export function fetchConnectNodes(start, end) {
    const id = uuidV4();

    return {
        start,
        end,
        [CALL_API]: {
            types: [ CONNECT_NODES_REQUEST, CONNECT_NODES_SUCCESS, CONNECT_NODES_FAILURE ],
            endpoint: 'Node.connect',
            payload: [ start, end, id ],
            schema: Schemas.EDGE,
        }
    }
}
export function connectNodes(start, end) {
    /*
     * we must first fetch the node, so we get its properties and show name and description
     */
    return (dispatch, getState) => {

        return dispatch(fetchConnectNodes(start, end))
        // return dispatch(fetchNode(end))
        //     .then(() => dispatch(fetchConnectNodes(start, end)))
    }
}


/*
 * Add a detailed (with content relation between two nodes
 */
export const ADD_EDGE_REQUEST = 'ADD_EDGE_REQUEST'
export const ADD_EDGE_SUCCESS = 'ADD_EDGE_SUCCESS'
export const ADD_EDGE_FAILURE = 'ADD_EDGE_FAILURE'
export function fetchAddEdge(start, end, content=null) {
    const id = uuidV4();

    return {
        start,
        end,
        content,
        [CALL_API]: {
            types: [ ADD_EDGE_REQUEST, ADD_EDGE_SUCCESS, ADD_EDGE_FAILURE ],
            endpoint: 'Node.addEdge',
            payload: [ start, end, id, content ],
            schema: Schemas.EDGE,
        }
    }
}
export function addEdge(start, end, content) {
    /*
     * we must first fetch the node, so we get its properties and show name and description
     *
     */
    return (dispatch) => {
        return dispatch(fetchAddEdge(start, end, content))
        // return dispatch(direction === "to" ? fetchNode(end) : fetchNode(start))
        //     .then(() => dispatch(fetchAddEdge(start, end, content, inGraphView)))
    }
}


/*
 * Remove a relation from node with id ${id}
 */

export const REMOVE_EDGE_REQUEST = 'REMOVE_EDGE_REQUEST'
export const REMOVE_EDGE_SUCCESS = 'REMOVE_EDGE_SUCCESS'
export const REMOVE_EDGE_FAILURE = 'REMOVE_EDGE_FAILURE'
export function fetchRemoveEdge(id, start, end) {
    return {
        id,
        start,
        end,
        [CALL_API]: {
            types: [ REMOVE_EDGE_REQUEST, REMOVE_EDGE_SUCCESS, REMOVE_EDGE_FAILURE ],
            endpoint: 'Node.removeEdge',
            payload: id,
        }
    }
}
export function removeEdge(id) {
    return (dispatch, getState) => {
        // get from, to edge id's then dispatch them to fetchRemoveEdge
        const edge = getEdge(getState(), id)

        if (!edge) {
            return Promise.reject(`edge with id ${id} doesn't exist`)
        }

        const start = edge.start
        const end = edge.end

        return dispatch(fetchRemoveEdge(id, start, end))
    }
}

/*
 * Get a node by id
 */
export const GET_ARCHIVE_REQUEST = 'GET_ARCHIVE_REQUEST'
export const GET_ARCHIVE_SUCCESS = 'GET_ARCHIVE_SUCCESS'
export const GET_ARCHIVE_FAILURE = 'GET_ARCHIVE_FAILURE'
export function loadArchive() {
    return {
        [CALL_API]: {
            types: [ GET_ARCHIVE_REQUEST, GET_ARCHIVE_SUCCESS, GET_ARCHIVE_FAILURE ],
            endpoint: 'Node.getArchive',
            schema: arrayOf(Schemas.NODE),
        }
    }
}
