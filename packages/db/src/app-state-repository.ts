import type { PrismaClient } from "@prisma/client";
import type { Logger } from "@spotify-helper/spotify";
export class PrismaAppStateRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  public async getValue(key: string): Promise<string | null> {
    const entry = await this.prisma.appState.findUnique({
      where: { key },
    });

    return entry?.value ?? null;
  }

  public async setValue(key: string, value: string): Promise<void> {
    await this.prisma.appState.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  public async deleteValue(key: string): Promise<void> {
    try {
      await this.prisma.appState.delete({
        where: { key },
      });
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  public async close(): Promise<void> {
    try {
      await this.prisma.$disconnect();
    } catch (error) {
      this.logger.warn(`Prisma disconnect failed: ${(error as Error).message}`);
    }
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2025"
  );
}
