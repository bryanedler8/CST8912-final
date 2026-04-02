const { CosmosClient } = require('@azure/cosmos');
//const { DefaultAzureCredential } = require('@azure/identity');

module.exports = async function (context, req) {
    context.log('Public API with Cosmos DB');
    
    const category = req.query.category;
    const id = req.query.id;
    
    //const connectionString = process.env.CosmosDbConnectionString;
    const connectionString = process.env.ROConnectionString;
    //const endpoint = process.env.CosmosDbEndpoint;
    const databaseId = process.env.CosmosDbDatabase;
    const containerId = process.env.CosmosDbContainer;
    
    context.log(`Connection String exists: ${!!connectionString}`);
    context.log(`Database: ${databaseId}, Container: ${containerId}`);
    
    // If no Cosmos DB configured, use sample data
    if (!connectionString) {
        context.log('Using sample data');
        const sampleData = [
            { id: "1", category: "announcements", title: "Welcome", content: "Add Cosmos DB connection string in Configuration" },
            { id: "2", category: "announcements", title: "System Ready", content: "API is working with sample data" },
            { id: "3", category: "resources", title: "Documentation", content: "Check the docs for examples" },
            { id: "4", category: "events", title: "Community Meetup", content: "Join us next week" }
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
        //const credential = new DefaultAzureCredential();
       // const client = new CosmosClient({ 
           // endpoint: endpoint, 
          //  aadCredentials: credential 
       // });
        const database = client.database(databaseId);
        const container = database.container(containerId);
        
        let items = [];
        
        if (id && category) {
            context.log(`Fetching item: ${category}/${id}`);
            const { resource } = await container.item(id, category).read();
            items = resource ? [resource] : [];
        } else if (category) {
            context.log(`Fetching category: ${category}`);
            const { resources } = await container.items
                .query({
                    query: "SELECT * FROM c WHERE c.category = @category",
                    parameters: [{ name: "@category", value: category }]
                })
                .fetchAll();
            items = resources;
        } else {
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
