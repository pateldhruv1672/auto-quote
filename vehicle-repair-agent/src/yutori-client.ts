import axios, { AxiosInstance } from "axios";
import {
  ResearchCreateRequest,
  ResearchCreateResponse,
  ResearchStatusResponse,
  BrowsingCreateRequest,
  BrowsingCreateResponse,
  BrowsingStatusResponse,
} from "./types";

export class YutoriClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: "https://api.yutori.com/v1",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
    });
  }

  // Research API Methods

  /**
   * Create a research task
   * Launches a one-time wide and deep research task on the web.
   */
  async createResearchTask(
    request: ResearchCreateRequest
  ): Promise<ResearchCreateResponse> {
    const response = await this.client.post<ResearchCreateResponse>(
      "/research/tasks",
      request
    );
    return response.data;
  }

  /**
   * Get research task status and results
   * Returns the current status and any results if completed.
   */
  async getResearchStatus(taskId: string): Promise<ResearchStatusResponse> {
    const response = await this.client.get<ResearchStatusResponse>(
      `/research/tasks/${taskId}`
    );
    return response.data;
  }

  /**
   * Poll for research task completion
   * Polls the status endpoint until the task is completed or failed.
   */
  async waitForResearchCompletion(
    taskId: string,
    pollIntervalMs: number = 5000,
    maxWaitMs: number = 300000
  ): Promise<ResearchStatusResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getResearchStatus(taskId);

      if (status.status === "succeeded" || status.status === "failed") {
        return status;
      }

      console.log(`Research task ${taskId} status: ${status.status}. Waiting...`);
      await this.sleep(pollIntervalMs);
    }

    throw new Error(`Research task ${taskId} timed out after ${maxWaitMs}ms`);
  }

  // Browsing API Methods

  /**
   * Create a browsing task
   * Launches a website navigation agent to execute the task on a cloud browser.
   */
  async createBrowsingTask(
    request: BrowsingCreateRequest
  ): Promise<BrowsingCreateResponse> {
    const response = await this.client.post<BrowsingCreateResponse>(
      "/browsing/tasks",
      request
    );
    return response.data;
  }

  /**
   * Get browsing task status and results
   * Returns the current status and any results if completed.
   */
  async getBrowsingStatus(taskId: string): Promise<BrowsingStatusResponse> {
    const response = await this.client.get<BrowsingStatusResponse>(
      `/browsing/tasks/${taskId}`
    );
    return response.data;
  }

  /**
   * Poll for browsing task completion
   * Polls the status endpoint until the task is completed or failed.
   */
  async waitForBrowsingCompletion(
    taskId: string,
    pollIntervalMs: number = 5000,
    maxWaitMs: number = 300000
  ): Promise<BrowsingStatusResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getBrowsingStatus(taskId);

      if (status.status === "succeeded" || status.status === "failed") {
        return status;
      }

      console.log(`Browsing task ${taskId} status: ${status.status}. Waiting...`);
      await this.sleep(pollIntervalMs);
    }

    throw new Error(`Browsing task ${taskId} timed out after ${maxWaitMs}ms`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
