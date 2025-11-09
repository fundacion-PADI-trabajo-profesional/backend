export interface SubmitAnswersPayload {
    evaluationId: string;
    areaId: string;
    questions: { id: string; answer: number }[];
}