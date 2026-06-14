export {};

declare global {
  interface Window {
    electronAPI?: {
      tunnelStart: (host: string, port: string, authtoken?: string) => Promise<{ ok: boolean; url?: string; error?: string }>;
      tunnelStop: () => Promise<{ ok: boolean; error?: string }>;
      tunnelStatus: () => Promise<{ active: boolean; url: string | null }>;
      onTunnelError: (callback: (msg: string) => void) => void;
    };
  }
}
