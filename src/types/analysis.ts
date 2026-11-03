export interface MetricExplanation {
  metric: string;
  value: string | number;
  plainEnglish: string;
}

export interface StockAnalysis {
  ticker: string;
  companyName: string;
  summary: string;
  technical_outlook: string;
  strengths: string[];
  risks: string[];
  key_metrics_explained: MetricExplanation[];
  generatedAt: string;
  disclaimer: string;
}
