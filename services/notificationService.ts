type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

class NotificationService {
  private permission: NotificationPermissionState = 'default';

  constructor() {
    if ('Notification' in window) {
      this.permission = Notification.permission as NotificationPermissionState;
    } else {
      this.permission = 'unsupported';
    }
  }

  isSupported(): boolean {
    return 'Notification' in window;
  }

  getPermission(): NotificationPermissionState {
    return this.permission;
  }

  needsPermissionRequest(): boolean {
    return this.isSupported() && this.permission === 'default';
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    if (!this.isSupported()) return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      this.permission = result as NotificationPermissionState;
      return this.permission;
    } catch {
      return this.permission;
    }
  }

  send(title: string, options?: { body?: string; icon?: string; tag?: string }) {
    if (!this.isSupported() || this.permission !== 'granted') return;
    try {
      const notif = new Notification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options,
      });
      setTimeout(() => notif.close(), 5000);
    } catch {
      // silent fail
    }
  }

  notifyDownload(fileName: string) {
    this.send('Download concluído', {
      body: `${fileName} foi baixado com sucesso.`,
      tag: 'download',
    });
  }

  notifyReceiptSaved(establishment: string) {
    this.send('Nota salva', {
      body: `Nota de "${establishment}" foi registrada.`,
      tag: 'receipt-saved',
    });
  }

  notifySefazSync(count: number) {
    this.send('Sincronização SEFAZ', {
      body: count > 0 ? `${count} nova(s) nota(s) encontrada(s).` : 'Nenhuma nota nova encontrada.',
      tag: 'sefaz-sync',
    });
  }
}

export const notificationService = new NotificationService();
