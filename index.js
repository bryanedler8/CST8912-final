const { CosmosClient } = require('@azure/cosmos');

module.exports = async function (context, req) {
    context.log('📊 Public API with Cosmos DB');
    
    const category = req.query.category;
    const id = req.query.id;
    
    const connectionString = process.env.CosmosDbConnectionString;
    const databaseId = process.env.CosmosDbDatabase;
    const containerId = process.env.CosmosDbContainer;
    
    if (!connectionString) {
        context.res = {
            status: 500,
            body: { error: "Cosmos DB not configured" }
        };
        return;
    }
    
    try {
        const client = new CosmosClient(connectionString);
        const container = client.database(databaseId).container(containerId);
        
        let items = [];
        
        if (id && category) {
            const { resource } = await container.item(id, category).read();
            items = resource ? [resource] : [];
        } else if (category) {
            const { resources } = await container.items
                .query({
                    query: "SELECT * FROM c WHERE c.category = @category",
                    parameters: [{ name: "@category", value: category }]
                })
                .fetchAll();
            items = resources;
        } else {
            const { resources } = await container.items
                .query("SELECT * FROM c")
                .fetchAll();
            items = resources;
        }
        
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: "success",
                timestamp: new Date().toISOString(),
                category: category || "all",
                count: items.length,
                data: items
            }
        };
        
    } catch (error) {
        context.res = {
            status: 500,
            body: {
                status: "error",
                message: error.message,
                timestamp: new Date().toISOString()
            }
        };
    }
};
