const uuidV4 = require('uuid/v4');
const createNodeApi = require('./index.js')
const config = require('../../../config/config.test.js')

let nodeApi;

describe('nodes', () => {
    beforeAll(() => {
        const driver = neo4j.driver(config.neo4j.url, neo4j.auth.basic(config.neo4j.user, config.neo4j.password))

        const db = driver.session();
        const es = elasticsearch.Client({
            host: 'localhost:9200',
            log: [{
                type: 'stdio',
                levels: ['error', 'warning']
            }]
        })

        nodeApi = createNodeApi(db, es)
    })
    test('should handle CREATE_NODE_SUCCESS', () => {
        const id = uuidV4()
        expect(
            nodesReducer({}, {
                type: actionTypes.CREATE_NODE_SUCCESS,
                id: id,
                response: {
                    entities: {
                        nodes: {
                            [id]: {
                                name: 'd',
                                modified: '1501582629992',
                                id: id,
                                type: 'node',
                                created: '1501582629992',
                                collectionChains: [],
                            }
                        }
                    },
                    result: id,
                },
                type: 'CREATE_NODE_SUCCESS'
            })
        ).toEqual({
            [id]: {
                name: 'd',
                modified: '1501582629992',
                id: id,
                type: 'node',
                created: '1501582629992',
                collectionChains: [],
            }
        })
    })
})

describe('abstractions', () => {

    /*
     * Test manipulating abstractions
    */
    test('add node to abstraction', () => {
        const collectionId = uuidV4()
        const id = uuidV4()

        const abstractionChain = [ collectionId ]

        const action = {
            collectionId: collectionId,
            nodeId: id,
            abstractionChain,
            response: {
                entities: {
                    collections: {
                        [ collectionId ]: {
                            name: 'My knowledge base',
                            modified: '1500203173558',
                            id: collectionId,
                            type: 'root',
                            isRootCollection: true
                        }
                    },
                    nodes: {
                        [ id ]: {
                            ok: 'what',
                            name: 'add_node',
                            modified: '1501584264723',
                            id: id,
                            type: 'node',
                            created: '1501584264723'
                        }
                    }
                },
                result: {
                    collection: collectionId,
                    node: id,
                }
            },
            type: 'ADD_NODE_TO_COLLECTION_SUCCESS'
        }

        expect(
            nodesReducer({
                [id]: {
                    name: 'd',
                    modified: '1501582629992',
                    id: id,
                    type: 'node',
                    created: '1501582629992',
                    collectionChains: [],
                }
            }, action)
        ).toEqual({
            [id]: {
                name: 'd',
                modified: '1501582629992',
                id: id,
                type: 'node',
                created: '1501582629992',
                collectionChains: [
                    abstractionChain,
                ]
            }
        })

        /*
         * adds the node to the nodes that will be considered for the derived data
        */
        expect(
            abstractionDetailReducer({
                [collectionId]: {
                    nodes: [],
                    edges: [],
                }
            }, action)
        ).toEqual({
            [collectionId]: {
                nodes: [ id ],
                edges: [],
            }
        })
    })

    test('Add abstraction to abstraction', () => {

    })

    test('should handle MOVE_TO_ABSTRACTION_SUCCESS', () => {
        /*
         *
        */

    })
})