# 跳过任务报告

> **状态：** 在第 2/3 阶段无法完成的任务的临时追踪文档。  
> 此文件被 gitignored，应在下一阶段开始时进行审查。

---

## T19 — Azure Blob Storage 连接器

**原始要求（第 2 阶段计划）：**  
实现一个数据源连接器，从 Azure Blob Storage 获取文档，以便系统可以自动吸收上传到 blob 容器的文件。

**为什么它被推迟：**

- 需要实时 Azure 凭证（`AZURE_BLOB_ACCOUNT_NAME`、`AZURE_BLOB_ACCOUNT_KEY`、`AZURE_BLOB_CONTAINER_NAME`）来开发和测试。
- 当前开发环境中没有 Azure 账户可用。
- 所有其他 22 个第 2 阶段任务都已完成，在 `docs/migrations/phase2-plan.cn.md` 中标记为 `[x]`。

---

### 当前状态

环境变量架构已支持 Azure Blob Storage（`src/lib/env.ts`）：

```typescript
const azureBlobSchema = z.object({
  AZURE_BLOB_ACCOUNT_NAME: z.string().optional(),
  AZURE_BLOB_ACCOUNT_KEY: z.string().optional(),
  AZURE_BLOB_CONTAINER_NAME: z.string().optional(),
});
```

`env.azure.blob.isConfigured` 标志可用，遵循与 Cosmos DB 和 OpenAI 连接器相同的模式。

---

### 实现设计

创建 `src/lib/datasources/azure-blob.connector.ts`，遵循与现有 `FileSystemConnector` 相同的接口：

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
      throw new Error("Azure Blob Storage 未配置");
    }
    this.id = `blob:${env.azure.blob.accountName}/${env.azure.blob.containerName}`;
    this.client = new BlobServiceClient(
      `https://${env.azure.blob.accountName}.blob.core.windows.net`,
      // 使用 StorageSharedKeyCredential 或 DefaultAzureCredential
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

所需 npm 包：`@azure/storage-blob`

```bash
npm install @azure/storage-blob
```

---

### Azure 凭证可用时的测试方法

1. 在 `.env` 中设置环境变量：

   ```dotenv
   AZURE_BLOB_ACCOUNT_NAME=<账户>
   AZURE_BLOB_ACCOUNT_KEY=<密钥>
   AZURE_BLOB_CONTAINER_NAME=documents
   ```

2. 上传测试文档到 blob 容器。

3. 手动运行连接器：

   ```typescript
   const connector = new AzureBlobConnector();
   const result = await connector.sync(ragService.ingest.bind(ragService));
   console.log(result);
   ```

4. 使用 `vi.mock("@azure/storage-blob")` 编写单元测试。

---

### 后续步骤

- [ ] 安装 `@azure/storage-blob`
- [ ] 按上面的设计实现 `AzureBlobConnector`
- [ ] 添加单元测试，使用模拟 Azure SDK
- [ ] 添加 API 端点 `POST /api/sync/blob` 来触发同步
- [ ] 在 `docs/migrations/phase2-plan.cn.md` 中将 T19 标记为 `[x]`
- [ ] 使用 blob 配置步骤更新 `docs/reference/DEPLOYMENT.cn.md`
