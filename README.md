

## Technical Documentation: Azure Function App & Cosmos DB Integration

### 1. Azure Function App Overview

The API is implemented as a serverless Azure Function App running on the **Consumption Plan**. This architecture was chosen for the following reasons:

| Feature | Benefit |
|---------|---------|
| **Serverless** | No infrastructure management, automatic scaling |
| **Consumption Plan** | Pay-per-execution, first 1M requests/month free |
| **Public endpoint** | HTTPS endpoint accessible from anywhere |
| **Read-only access** | Anonymous GET requests only (no authentication required) |

### 2. Function App Configuration

| Setting | Value |
|---------|-------|
| **Runtime Stack** | Node.js |
| **Runtime Version** | 18 LTS |
| **Function Runtime Version** | ~4 |
| **Operating System** | Linux |
| **Hosting Plan** | Consumption (Serverless) |

### 3. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/data` | GET | Retrieve all published data |
| `/api/data?category={category}` | GET | Filter data by category |
| `/api/data?category={category}&id={id}` | GET | Retrieve specific item |

**Example Response:**
```json
{
    "status": "success",
    "timestamp": "2026-04-01T...",
    "category": "announcements",
    "count": 2,
    "data": [
        {
            "id": "1",
            "category": "announcements",
            "title": "Welcome",
            "content": "Content here"
        }
    ]
}
```

---

### 4. Critical Issue: Node.js Version Compatibility with Cosmos DB SDK

During development, a significant compatibility issue was encountered between the Azure Functions runtime and the Azure Cosmos DB JavaScript SDK.

#### 4.1 The Problem

| Component | Version Requirement | Actual Version |
|-----------|---------------------|----------------|
| **Azure Functions (Consumption Plan)** | Node.js 18 (default) | 18.20.7 |
| **@azure/cosmos SDK (latest)** | Node.js 20+ | 4.9.2 |
| **@azure/cosmos SDK (compatible)** | Node.js 18 | 3.17.3 |

The latest version of the `@azure/cosmos` package (v4.x) **requires Node.js 20 or higher**. However, Azure Functions Consumption Plan **defaults to Node.js 18**, creating an incompatibility.

#### 4.2 Error Encountered

When attempting to use the latest Cosmos DB SDK (v4.9.2) with Node.js 18, the following error occurred:

```
Error: crypto is not defined
```

**Root Cause:** The newer SDK relies on Node.js 20's built-in Web Crypto API, which is not available in Node.js 18.

#### 4.3 npm Warnings During Installation

```
npm warn EBADENGINE Unsupported engine {
  package: '@azure/cosmos@4.9.2',
  required: { node: '>=20.0.0' },
  current: { node: 'v18.20.7', npm: '10.8.2' }
}
```

#### 4.4 Solutions Evaluated

| Solution | Status | Outcome |
|----------|--------|---------|
| **Upgrade Function App to Node.js 20** | Available | Set `WEBSITE_NODE_DEFAULT_VERSION=~20` in Configuration |
| **Use older Cosmos DB SDK (v3.17.3)** | Implemented  | Works with Node.js 18 |
| **Use sample data (no Cosmos DB)** | Working fallback | API functions without database |

#### 4.5 Final Implementation Decision

To ensure stability and avoid runtime errors, the **older compatible version** of the Cosmos DB SDK was implemented:

```json
{
    "dependencies": {
        "@azure/cosmos": "3.17.3"
    }
}
```

This version:
-  Works with Node.js 18
-  Supports all required Cosmos DB operations
-  Has no dependency on Node.js 20 features

---

### 5. Cosmos DB Connection Implementation

The function code includes a **graceful fallback pattern**:

```javascript
if (!connectionString) {
    // Use sample data (fallback)
    return sampleData;
} else {
    // Connect to Cosmos DB
    const client = new CosmosClient(connectionString);
    // Query and return real data
}
```

**Application Settings Required for Cosmos DB:**

| Setting Name | Value | Purpose |
|--------------|-------|---------|
| `CosmosDbConnectionString` | `AccountEndpoint=...;AccountKey=...;` | Database connection |
| `CosmosDbDatabase` | `PublicDataDB` | Database name |
| `CosmosDbContainer` | `PublicItems` | Container name |

---

### 6. Lessons Learned

1. **Version Compatibility Matters:** Always verify SDK requirements against the target runtime environment before implementation.

2. **Azure Functions Runtime Constraints:** The Consumption Plan has fixed runtime versions that cannot be changed without configuration overrides.

3. **Graceful Fallbacks:** Implementing fallback mechanisms (sample data) ensures the API remains functional even when external dependencies are unavailable.

4. **npm Engine Warnings:** These warnings should not be ignored; they indicate potential compatibility issues that may cause runtime failures.

---

### 7. References

- [Azure Functions Node.js Development Guide](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node)
- [Cosmos DB JavaScript SDK Version History](https://www.npmjs.com/package/@azure/cosmos)
- [Azure Functions Runtime Versions](https://docs.microsoft.com/en-us/azure/azure-functions/functions-versions)
- [Node.js Compatibility with Azure Functions](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#node-version)

