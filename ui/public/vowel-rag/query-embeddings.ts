import { env, pipeline, type FeatureExtractionPipeline, type Tensor } from '@huggingface/transformers'

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'
const EMBEDDING_DIMENSIONS = 384

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null

const createFeatureExtractionPipeline = pipeline as unknown as (
  task: 'feature-extraction',
  model: string,
  options: { device: 'webgpu' | 'wasm' }
) => Promise<FeatureExtractionPipeline>

function configureTransformersEnv(): void {
  // Prefer the remote model host and browser cache instead of probing same-origin
  // /models/* paths that Vite/VitePress may serve as HTML fallback pages.
  env.allowLocalModels = false
  env.allowRemoteModels = true
  env.useBrowserCache = true
}

async function createExtractor(): Promise<FeatureExtractionPipeline> {
  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator
  const options = { device: hasWebGPU ? 'webgpu' : 'wasm' } as const

  configureTransformersEnv()


  console.log("try to createFeatureExtractionPipeline", options)

  const pipeline = await createFeatureExtractionPipeline(
    'feature-extraction',
    EMBEDDING_MODEL,
    options
  )

  console.log('createFeatureExtractionPipeline success', options)

  return pipeline;
}

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = createExtractor().catch((error) => {
      extractorPromise = null
      throw error
    })
  }

  return await extractorPromise
}

function tensorToVector(tensor: Tensor): number[] {
  const dimensions = tensor.dims[tensor.dims.length - 1]
  if (!dimensions) {
    throw new Error('Embedding tensor did not include dimensions')
  }

  const values = Array.from(tensor.data, (value) => Number(value))
  const vector = values.slice(0, dimensions)

  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS}-dimensional embedding, received ${vector.length}`)
  }

  return vector
}

export async function getQueryEmbedding(query: string): Promise<number[]> {
  const extractor = await getExtractor()
  const tensor = await extractor(query, {
    pooling: 'mean',
    normalize: true,
  })

  return tensorToVector(tensor)
}
