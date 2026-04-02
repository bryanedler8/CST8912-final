const { CosmosClient } = require('@azure/cosmos');

module.exports = async function (context, req) {
    context.log('Public API with Cosmos DB');
    
    const category = req.query.category;
    const id = req.query.id;
    
    const connectionString = process.env.ROConnectionString;
    const databaseId = process.env.CosmosDbDatabase;
    const containerId = process.env.CosmosDbContainer;
    
    context.log(`Connection String exists: ${!!connectionString}`);
    context.log(`Database: ${databaseId}, Container: ${containerId}`);
    context.log(`Query - Category: ${category || 'none'}, ID: ${id || 'none'}`);
    
    // Helper function to clean Cosmos DB items (remove system metadata)
    function cleanItem(item) {
        return {
            id: item.id,
            category: item.category,
            title: item.title,
            content: item.content,
            publishedDate: item.publishedDate,
            department: item.department,
            status: item.status
        };
    }
    
    // Check if Cosmos DB is configured
    if (!connectionString) {
        context.log.error('Cosmos DB connection string not configured');
        context.res = {
            status: 500,
            body: {
                status: "error",
                message: "Cosmos DB connection string not configured. Please add ROConnectionString to Application Settings.",
                timestamp: new Date().toISOString()
            }
        };
        return;
    }
    
    try {
        context.log('Connecting to Cosmos DB...');
        const client = new CosmosClient(connectionString);
        const database = client.database(databaseId);
        const container = database.container(containerId);
        
        let items = [];
        
        // CASE 1: Both ID and Category provided - Most efficient (Point Read)
        if (id && category) {
            context.log(`Fetching item: ${category}/${id}`);
            const { resource } = await container.item(id, category).read();
            items = resource ? [cleanItem(resource)] : [];
        }
        // CASE 2: Only ID provided - Search across all categories (Cross-partition query)
        else if (id && !category) {
            context.log(`Searching for ID: ${id} across all categories`);
            const querySpec = {
                query: "SELECT * FROM c WHERE c.id = @id",
                parameters: [{ name: "@id", value: id }]
            };
            const { resources } = await container.items.query(querySpec, {
                enableCrossPartitionQuery: true
            }).fetchAll();
            items = resources.map(cleanItem);
            
            if (items.length === 0) {
                context.log(`Item with ID ${id} not found`);
            }
        }
        // CASE 3: Only Category provided - Filter by category
        else if (category) {
            context.log(`Fetching category: ${category}`);
            const allowedCategories = ['announcements', 'news', 'events', 'notices'];
            if (!allowedCategories.includes(category)) {
                context.res = {
                    status: 400,
                    body: {
                        status: "error",
                        message: `Invalid category. Allowed values: ${allowedCategories.join(', ')}`,
                        timestamp: new Date().toISOString()
                    }
                };
                return;
            }
            
            const { resources } = await container.items
                .query({
                    query: "SELECT * FROM c WHERE c.category = @category",
                    parameters: [{ name: "@category", value: category }]
                })
                .fetchAll();
            items = resources.map(cleanItem);
        }
        // CASE 4: No parameters - Get all items
        else {
            context.log('Fetching all items');
            const { resources } = await container.items
                .query("SELECT * FROM c")
                .fetchAll();
            items = resources.map(cleanItem);
        }
        
        context.log(`Retrieved ${items.length} items from Cosmos DB`);
        
        context.res = {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                status: "success",
                timestamp: new Date().toISOString(),
                category: category || "all",
                count: items.length,
                data: items,
                source: "cosmos-db"
            }
        };
        
    } catch (error) {
        context.log.error(`Error: ${error.message}`);
        context.res = {
            status: 500,
            body: {
                status: "error",
                message: `Database error: ${error.message}`,
                timestamp: new Date().toISOString()
            }
        };
    }
};
