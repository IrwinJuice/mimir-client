import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from '../../environments/environment';

export interface WebSocketNotification {
  event: WebSocketNotificationKind,
  ida?: number,
  external_id?: string,
  masked_pan?: string
}

export enum WebSocketNotificationKind {
  MONITOR_UPDATED = "monitor_updated",
  MONITOR_PENDING = "monitor_pending",
  ALL_MONITORS_UPDATED = "all_monitors_updated",
}

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private socket: WebSocket;

  connect(): Observable<MessageEvent> {
    this.socket = new WebSocket(`${environment.ws}`);

    return new Observable(observer => {
      this.socket.onmessage = (event) => observer.next(event);
      this.socket.onerror = (err) => observer.error(err);
      this.socket.onclose = () => observer.complete();
    });
  }

  sendMessage(message: string) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    }
  }
}
