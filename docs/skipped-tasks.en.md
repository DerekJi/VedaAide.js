# Skipped Tasks Report

> **Status:** Temporary tracking document for tasks that could not be completed during Phase 2/3.  
> This file is gitignored and should be reviewed at the start of the next phase.

---

## T19 — Azure Blob Storage Connector

**Original requirement (Phase 2 plan):**  
Implement a data source connector that fetches documents from Azure Blob Storage, so the system can auto-ingest files uploaded to a blob container.

**Why it was deferred:**

- Requires live Azure credentials (`AZURE_BLOB_ACCOUNT_NAME`, `AZURE_BLOB_ACCOUNT_KEY`, `AZURE_BLOB_CONTAINER_NAME`) to develop and test.
- No Azure account is available in the current development environment.
- All other 22 Phase 2 tasks were completed and are marked `[x]` in `docs/migrations/phase2-plan.cn.md`.

---

### Current State

The environment variable schema already supports Azure Blob Storage (`src/lib/env.ts`):

```typescript
const azureBlobSchema = z.object({
  AZURE_BLOB_ACCOUNT_NAME: z.string().optional(),
  AZURE_BLOB_ACCOUNT_KEY: z.string().optional(),
  AZURE_BLOB_CONTAINER_NAME: z.string().optional(),
});
```

The `env.azure.blob.isConfigured` flag is available and follows the same pattern as the Cosmos DB and OpenAI connectors.

---

### Design for Implementation

Create `src/lib/datasources/azure-blob.connector.ts` following the same interface as the existing `FileSystemConnector`:

```typescript
import { BlobServiceClient } from "@azure/storage-blob";
import { env } from "@/lib/env";
import type { IDataSourceConnector, SyncResult } from "./connector";

export class AzureBlobConnector implements IDataSourceConnector {
  readonly id: string;
  private readonly client: BlobServiceClient;
  private readonly containerName: string;

  constructor() {
    if (!env.azure.blob.isConfigured) {
      throw new Error("Azure Blob Storage is not configured");
    }
    this.id = `blob:${env.azure.blob.accountName}/${env.azure.blob.containerName}`;
    this.client = new BlobServiceClient(
      `https://${env.azure.blob.accountName}.blob.core.windows.net`,
      // Use StorageSharedKeyCredential or DefaultAzureCredential
    );
    this.containerName = env.azure.blob.containerName!;
  }

  async sync(ingest: (req: IngestRequest) => Promise<IngestResult>): Promise<SyncResult> {
    const container = this.client.getContainerClient(this.containerName);
    const results: SyncResult = { processed: 0, skipped: 0, errors: [] };

    for await (const blob of container.listBlobsFlat()) {
      const blobClient = container.getBlobClient(blob.name);
      const download = await blobClient.download();
      const content = await streamToString(download.readableStreamBody!);

      try {
        const result = await ingest({ source: `blob:${blob.name}`, content });
        result.skipped ? results.skipped++ : results.processed++;
      } catch (err) {
        results.errors.push(`${blob.name}: ${String(err)}`);
      }
    }

    return results;
  }
}
```

Required npm package: `@azure/storage-blob`

```bash
npm install @azure/storage-blob
```

---

### How to Test When Azure Credentials Are Available

1. Set environment variables in `.env`:

   ```dotenv
   AZURE_BLOB_ACCOUNT_NAME=<account>
   AZURE_BLOB_ACCOUNT_KEY=<key>
   AZURE_BLOB_CONTAINER_NAME=documents
   ```

2. Upload a test document to the blob container.

3. Run the connector manually:

   ```typescript
   const connector = new AzureBlobConnector();
   const result = await connector.sync(ragService.ingest.bind(ragService));
   console.log(result);
   ```

4. Write unit tests using `vi.mock("@azure/storage-blob")`.

---

### Next Steps

- [ ] Install `@azure/storage-blob`
- [ ] Implement `AzureBlobConnector` following the design above
- [ ] Add unit tests with mocked Azure SDK
- [ ] Add an API endpoint `POST /api/sync/blob` that triggers a sync
- [ ] Mark T19 as `[x]` in `docs/migrations/phase2-plan.cn.md`
- [ ] Update `docs/reference/DEPLOYMENT.en.md` with blob configuration steps
