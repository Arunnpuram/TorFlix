// torrent-search-api ships no types; declare the minimal surface we use.
declare module "torrent-search-api" {
  export interface SearchResult {
    title: string;
    time?: string;
    seeds?: number | string;
    peers?: number | string;
    size?: string;
    magnet?: string;
    desc?: string;
    provider: string;
    link?: string;
  }
  export function enableProvider(name: string): void;
  export function disableAllProviders(): void;
  export function getActiveProviders(): { name: string; public: boolean }[];
  export function search(
    providers: string[] | string,
    query: string,
    category?: string,
    limit?: number,
  ): Promise<SearchResult[]>;
  export function getMagnet(result: SearchResult): Promise<string>;
}
