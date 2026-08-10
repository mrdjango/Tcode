import { TensorGridCatalogModel, TENSORGRID_GOOGLE_BASE_URL, TENSORGRID_OPENAI_BASE_URL } from './tensorgrid-catalog-service';

export type TensorGridRoute =
    | { provider: 'openai'; id: string; model: string; url: string; useResponseApi: boolean }
    | { provider: 'anthropic'; id: string; model: string; url: string }
    | { provider: 'google'; id: string; model: string; baseURL: string; apiVersion: string }
    | { provider: 'skip'; reason: string };

const normalize = (value: string) => value.trim().toLowerCase();
const supports = (endpoints: string[], values: string[]) => endpoints.map(normalize).some(endpoint => values.includes(endpoint));

/** Routes only explicit TensorGrid metadata; ids are never used as a provider fallback. */
export function routeTensorGridModel(entry: TensorGridCatalogModel): TensorGridRoute {
    const model = entry.id.trim();
    if (!model || normalize(entry.category) !== 'language') {
        return { provider: 'skip', reason: 'not a chat-capable language model' };
    }
    const family = model.split(':').at(-1)?.toLowerCase() ?? '';
    const id = `tensorgrid/${model.replace(/^tensorgrid\//, '')}`;
    if (family.includes('claude')) {
        return supports(entry.endpointTypes, ['messages', 'anthropic'])
            ? { provider: 'anthropic', id, model, url: TENSORGRID_OPENAI_BASE_URL }
            : { provider: 'skip', reason: 'Claude model lacks messages endpoint' };
    }
    if (family.includes('gemini')) {
        return supports(entry.endpointTypes, ['generatecontent', 'gemini'])
            ? { provider: 'google', id, model, baseURL: TENSORGRID_GOOGLE_BASE_URL, apiVersion: 'v1beta' }
            : { provider: 'skip', reason: 'Gemini model lacks generateContent endpoint' };
    }
    const chat = supports(entry.endpointTypes, ['chat.completions', 'openai']);
    const responses = supports(entry.endpointTypes, ['responses', 'openai responses', 'openai-response']);
    return chat || responses
        ? { provider: 'openai', id, model, url: TENSORGRID_OPENAI_BASE_URL, useResponseApi: responses && !chat }
        : { provider: 'skip', reason: 'model lacks a compatible chat endpoint' };
}
