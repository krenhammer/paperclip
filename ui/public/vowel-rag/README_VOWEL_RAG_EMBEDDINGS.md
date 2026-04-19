# Vowel RAG Embeddings for Paperclip Docs

This document explains the RAG (Retrieval-Augmented Generation) embedding system adapted from [vowel.to](https://vowel.to) for the Paperclip documentation.

## Overview

This embedding system enables AI-powered search and question-answering over the Paperclip documentation. It works by:

1. **Pre-processing** all Markdown documentation files
2. **Chunking** documents into semantic segments
3. **Generating embeddings** using the `all-MiniLM-L6-v2` model (384 dimensions)
4. **Storing** vectors for similarity search

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Markdown Docs  │────▶│  Chunking Engine │────▶│  Embedding Gen  │
│  (source files) │     │  (sentence-aware)│     │  (llama.cpp)    │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                           │
                    ┌──────────────────────────────────────┘
                    ▼
           ┌─────────────────┐
           │  rag-index.yml  │────▶ Vector DB (Turso/libSQL)
           │  (384-d vectors)│
           └─────────────────┘
                    │
           ┌─────────────────┐
           │rag-documents.yml│────▶ Full-text retrieval
           │  (complete docs)│
           └─────────────────┘
```

## File Structure

```
scripts/
├── build-rag.py           # Main build script
├── requirements.txt       # Python dependencies
├── README.md             # Script documentation
└── .gitignore           # Excludes binaries and cache

public/
├── query-embeddings.ts   # Client-side query embedding
├── rag-index.yml         # Chunk embeddings output
└── rag-documents.yml     # Document content output
```

## Quick Start

### 1. Install Dependencies

```bash
# Using uv (recommended)
uv pip install -r scripts/requirements.txt

# Or using pip
pip install -r scripts/requirements.txt
```

### 2. Build Embeddings

```bash
uv run python scripts/build-rag.py
```

On first run, this will:
- Download `llama-server` binary with Vulkan support (~50MB)
- Download the GGUF embedding model (~20MB)
- Process all Markdown files
- Generate embeddings
- Save outputs to `public/`

### 3. Use in Your Application

```typescript
import { getQueryEmbedding } from './public/query-embeddings'

// Generate query embedding
const query = "How do I create an agent in Paperclip?"
const embedding = await getQueryEmbedding(query)

// Search using Turso/libSQL vector similarity
const results = await db.execute({
  sql: `SELECT text, vector_distance_cos(vector, vector32(?)) as distance
        FROM embeddings
        ORDER BY distance
        LIMIT 5`,
  args: [JSON.stringify(embedding)]
})
```

## Configuration

### Model Settings

| Setting | Value | Description |
|---------|-------|-------------|
| Model | `Xenova/all-MiniLM-L6-v2` | Sentence transformer |
| Dimensions | 384 | Vector size |
| Metric | Cosine | Similarity measure |
| Format | float32-array | Vector storage |

### Chunking Settings

| Setting | Value | Description |
|---------|-------|-------------|
| Chunk Size | 400 chars | ~100 tokens |
| Overlap | 50 chars | Context preservation |
| Min Length | 50 chars | Filters small chunks |

### Build Settings

| Setting | Default | Description |
|---------|---------|-------------|
| llama_version | 8698 | llama.cpp release |
| n_gpu_layers | 99 | GPU offload layers |
| n_parallel | 64 | Concurrent slots |
| context_length | 512 | Max tokens |

## Incremental Builds

The build system tracks file changes and only regenerates embeddings for modified content:

```bash
# First build - full regeneration
uv run python scripts/build-rag.py
# [rag]: Created 150 chunks (0 skipped, 150 new)

# Second build - incremental (files unchanged)
uv run python scripts/build-rag.py
# [rag]: Created 150 chunks (150 skipped, 0 new)

# After editing a file - partial rebuild
uv run python scripts/build-rag.py
# [rag]: Created 150 chunks (145 skipped, 5 new)
```

Build state is cached in `scripts/.rag-build-state.yml`.

## Output Format

### rag-index.yml

Contains chunked document embeddings:

```yaml
version: 2.0.0
model: second-state/All-MiniLM-L6-v2-Embedding-GGUF
dimensions: 384
metric: cosine
chunk_count: 150
chunks:
  - id: start/quickstart-a1b2c3d4e5f6
    text: '[Quickstart]\n\nGet Paperclip running locally...'
    vector: [0.023, -0.112, ...]  # 384 floats
    metadata:
      title: Quickstart
      path: start/quickstart
      urlPath: /start/quickstart
      category: Getting Started
      chunkIndex: 0
      totalChunks: 3
```

### rag-documents.yml

Contains full document content for hierarchical retrieval:

```yaml
version: 2.0.0
document_count: 50
documents:
  start/quickstart:
    title: Quickstart
    description: Get Paperclip running in minutes
    category: Getting Started
    url_path: /start/quickstart
    content: "Full document content..."
    word_count: 150
    char_count: 1200
```

## Client-Side Query Embedding

The `query-embeddings.ts` module provides browser-based query embedding:

```typescript
import { getQueryEmbedding } from './query-embeddings'

// Works in browsers with WebGPU or WASM fallback
const embedding = await getQueryEmbedding("How do agents work?")
// Returns: number[384]
```

**Features:**
- Uses Transformers.js for local inference
- WebGPU acceleration when available
- WASM fallback for compatibility
- Caches model in browser storage

## Integration Patterns

### Pattern 1: Direct Vector Search (Turso/libSQL)

```typescript
import { getQueryEmbedding } from './query-embeddings'
import { createClient } from '@libsql/client'

const db = createClient({ url: 'libsql://...' })

async function searchDocs(query: string) {
  const embedding = await getQueryEmbedding(query)

  const results = await db.execute({
    sql: `SELECT metadata, text,
          vector_distance_cos(vector, vector32(?)) as score
          FROM doc_embeddings
          ORDER BY score
          LIMIT 5`,
    args: [JSON.stringify(embedding)]
  })

  return results.rows
}
```

### Pattern 2: Hierarchical Retrieval (Parent Document)

```typescript
async function searchWithContext(query: string) {
  // 1. Search chunks for relevant matches
  const chunkResults = await searchChunks(query)

  // 2. Load full documents for top matches
  const docPaths = [...new Set(chunkResults.map(r => r.path))]
  const fullDocs = await loadDocuments(docPaths)

  // 3. Return chunks + full context
  return {
    matches: chunkResults,
    context: fullDocs
  }
}
```

### Pattern 3: RAG Pipeline

```typescript
async function ragAnswer(query: string) {
  // 1. Retrieve relevant chunks
  const chunks = await searchDocs(query)

  // 2. Build context from top chunks
  const context = chunks
    .slice(0, 3)
    .map(c => c.text)
    .join('\n\n---\n\n')

  // 3. Generate answer with LLM
  const answer = await llm.generate({
    prompt: `Based on this context:\n${context}\n\nAnswer: ${query}`
  })

  return answer
}
```

## Vowel Integration

This system is designed to integrate with [vowel.to](https://vowel.to) voice AI:

### Vowel Agent Configuration

```yaml
# vowel-agent-config.yaml
rag:
  index_url: /rag-index.yml
  documents_url: /rag-documents.yml
  max_results: 5
  similarity_threshold: 0.7

actions:
  search_docs:
    description: Search Paperclip documentation
    handler: searchRAG
```

### Voice-Enabled Doc Search

```typescript
// Vowel action handler
import { getQueryEmbedding } from './query-embeddings'

export const searchDocsAction = {
  name: 'searchDocumentation',
  description: 'Search Paperclip docs for information',
  parameters: {
    query: { type: 'string', description: 'Search query' }
  },
  async handler({ query }) {
    const embedding = await getQueryEmbedding(query)
    const results = await searchIndex(embedding)

    return {
      found: results.length > 0,
      results: results.slice(0, 3),
      sources: results.map(r => r.urlPath)
    }
  }
}
```

## Excluded Content

The following files are excluded from indexing:

- `AGENTS.md` - Internal agent instructions
- `CONTRIBUTING.md` - Contribution guidelines
- `README.md` - Repository readme
- `LICENSE` - License file
- `scripts/` - Build scripts
- `images/` - Static assets
- `logo/` - Logo assets

## Troubleshooting

### Build Issues

**Vulkan not available:**
```bash
# The build will automatically fall back to CPU
# Slower but works on any system
```

**Out of memory:**
```python
# In build-rag.py, reduce parallel slots:
n_parallel: int = 16  # Instead of 64
```

**Corrupted build state:**
```bash
rm scripts/.rag-build-state.yml
rm -rf scripts/llama-b*/
uv run python scripts/build-rag.py
```

### Runtime Issues

**Model loading fails in browser:**
- Check Transformers.js version compatibility
- Verify CORS headers for model hosting
- Clear browser cache and reload

**Embedding mismatch:**
- Ensure build model matches query model
- Both must use `all-MiniLM-L6-v2`
- Check vector dimensions (384)

## Performance

### Build Performance

| Metric | Typical Value |
|--------|--------------|
| Documents | 50-100 |
| Chunks | 150-300 |
| Build Time | 30-60s (GPU) |
| Build Time | 2-5m (CPU) |
| Index Size | 1-5 MB |

### Query Performance

| Environment | Latency |
|-------------|---------|
| WebGPU | 50-100ms |
| WASM | 200-500ms |
| Search (Turso) | 5-20ms |

## References

- [vowel.to Documentation](https://vowel.to)
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [llama.cpp](https://github.com/ggml-org/llama.cpp)
- [Turso Vector Search](https://docs.turso.tech/features/vector-search)
- [all-MiniLM-L6-v2 Model](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)

## License

The embedding system is adapted from vowel.to's open-source RAG implementation. The `all-MiniLM-L6-v2` model is licensed under Apache 2.0.
