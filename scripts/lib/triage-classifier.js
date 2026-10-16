import { classify } from '@earendil-works/pi-ai/api/typesafe-system-one';

// The AI gateway's decision model. It answers warlock's triage questions with
// a probability, through POST /v1/systemone.
export const TRIAGE_MODEL_ID = 'openai/gpt-6-luna';

/**
 * A warlock TriageClassifier: pi-ai's `classify()` on the gateway's decision
 * model, authenticated with the gateway token. pi-ai retries transient errors
 * and reports a failed call in the result, which warlock treats as a threat.
 */
export function createTriageClassifier({ gatewayURL, token, fetch }) {
    const model = {
        id: TRIAGE_MODEL_ID,
        name: 'gpt-6-luna',
        api: 'typesafe-system-one',
        provider: 'posthog-ai-gateway',
        baseUrl: `${gatewayURL}/v1`,
        type: 'classifier',
        input: ['text'],
        contextWindow: 262_144,
        cost: { input: 0.1, output: 0, cacheRead: 0, cacheWrite: 0 },
    };
    return (context) => classify(model, context, { apiKey: token, fetch });
}
