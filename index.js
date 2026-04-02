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
    
    // If no Cosmos DB configured, use sample data
    if (!connectionString) {
        context.log('Using sample data');
        const sampleData = [
            { id: "1", category: "announcements", title: "Welcome", content: "Add Cosmos DB connection string in Configuration" },
            { id: "2", category: "announcements", title: "System Ready", content: "API is working with sample data" },
            { id: "3", category: "news", title: "Breaking News", content: "Important news update" },
            { id: "4", category: "events", title: "Community Meetup", content: "Join us next week" },
            { id: "5", category: "notice", title: "Maintenance Notice", content: "Scheduled maintenance" }
        ];
        
        let result = sampleData;
        if (category) {
            result = sampleData.filter(item => item.category === category);
        }
        if (id) {
            result = result.filter(item => item.id === id);
        }
        
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: "success",
                source: "sample-data",
                timestamp: new Date().toISOString(),
                category: category || "all",
                count: result.length,
                data: result
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
            items = resource ? [resource] : [];
        }
        // CASE 2: Only ID provided - Search across all categories (Cross-partition query)
        else if (id && !category) {
            context.log(`Searching for ID: ${id} across all categories`);
            const querySpec = {
                query: "SELECT * FROM c WHERE c.id = @id",
                parameters: [{ name: "@id", value: id }]
            };
            const { resources } = await container.items.query(querySpec, {
                enableCrossPartitionQuery: true  // Required to search without partition key
            }).fetchAll();
            items = resources;
            
            if (items.length === 0) {
                context.log(`Item with ID ${id} not found`);
            } else {
                context.log(`Found item with ID ${id} in category: ${items[0].category}`);
            }
        }
        // CASE 3: Only Category provided - Filter by category
        else if (category) {
            context.log(`Fetching category: ${category}`);
            // Validate category is one of the allowed values
            const allowedCategories = ['announcements', 'news', 'events', 'notice'];
            if (!allowedCategories.includes(category)) {
                context.log.warn(`Invalid category: ${category}. Allowed: ${allowedCategories.join(', ')}`);
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
            items = resources;
        }
        // CASE 4: No parameters - Get all items
        else {
            context.log('Fetching all items');
            const { resources } = await container.items
                .query("SELECT * FROM c")
                .fetchAll();
            items = resources;
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
                message: error.message,
                timestamp: new Date().toISOString()
            }
        };
    }
};
