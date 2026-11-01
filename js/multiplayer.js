/**
 * 서버리스(24시간 백엔드 서버 없음) P2P 호스트 멀티플레이어 매니저
 * - PeerJS (WebRTC DataChannel) + BroadcastChannel (동일 브라우저 탭 간 즉시 동기화 폴백)
 * - 갈틱폰 스타일의 짧은 방 코드(예: 4자리 영문/숫자)로 방 만들기 & 방 찾기(입장) 지원
 */

const ROOM_PREFIX = 'PCARE-ROOM-';
const BC_CHANNEL_NAME = 'prompt-carefully-p2p-bus';

export const PLAYER_COLORS = [
  { name: '블루', body: 0x38bdf8, accent: 0xec4899, hex: '#38bdf8' },
  { name: '핑크', body: 0xec4899, accent: 0x38bdf8, hex: '#ec4899' },
  { name: '민트', body: 0x10b981, accent: 0xfacc15, hex: '#10b981' },
  { name: '골드', body: 0xfacc15, accent: 0xef4444, hex: '#facc15' },
  { name: '퍼플', body: 0xa855f7, accent: 0x38bdf8, hex: '#a855f7' },
  { name: '코랄', body: 0xf97316, accent: 0xfacc15, hex: '#f97316' },
  { name: '라임', body: 0x84cc16, accent: 0x06b6d4, hex: '#84cc16' },
  { name: '화이트', body: 0xf8fafc, accent: 0xec4899, hex: '#f8fafc' }
];

export class MultiplayerManager {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.peer = null;
    this.isHost = false;
    this.roomCode = '';
    this.myId = 'p_' + Math.random().toString(36).substring(2, 9);
    this.myNickname = '';

    // Host 전용 연결 맵: playerId -> PeerJS DataConnection
    this.connections = new Map();
    // Guest 전용 호스트 연결
    this.hostConn = null;

    // 같은 PC 다른 탭 테스트 및 초고속 로컬 동기화용 BroadcastChannel
    this.bc = null;
    try {
      this.bc = new BroadcastChannel(BC_CHANNEL_NAME);
      this.bc.onmessage = (e) => this.handleBroadcastMessage(e.data);
    } catch (_) {
      // BroadcastChannel 미지원 환경 무시
    }
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  cleanupPeer() {
    if (this.hostConn) {
      try { this.hostConn.close(); } catch (_) {}
      this.hostConn = null;
    }
    this.connections.forEach((conn) => {
      try { conn.close(); } catch (_) {}
    });
    this.connections.clear();
    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }
  }

  /**
   * 방 만들기 (내가 호스트가 됨)
   */
  async createRoom(nickname) {
    this.cleanupPeer();
    this.isHost = true;
    this.myNickname = nickname || '방장';
    this.roomCode = this.generateRoomCode();

    const peerId = `${ROOM_PREFIX}${this.roomCode}`;

    return new Promise((resolve, reject) => {
      let resolved = false;

      // 만약 PeerJS CDN 로드 실패나 오프라인 환경이어도 로컬/탭 멀티플레이는 즉시 동작하도록 안전장치
      if (typeof window.Peer === 'undefined') {
        resolved = true;
        resolve({ roomCode: this.roomCode, myId: this.myId, isHost: true });
        return;
      }

      try {
        this.peer = new window.Peer(peerId, {
          debug: 1
        });
      } catch (err) {
        resolved = true;
        resolve({ roomCode: this.roomCode, myId: this.myId, isHost: true });
        return;
      }

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ roomCode: this.roomCode, myId: this.myId, isHost: true });
        }
      }, 3500);

      this.peer.on('open', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ roomCode: this.roomCode, myId: this.myId, isHost: true });
        }
      });

      this.peer.on('connection', (conn) => {
        this.setupHostConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('PeerJS Host 경고:', err);
        if (err.type === 'unavailable-id' && !resolved) {
          // 코드가 겹쳤으면 재생성
          clearTimeout(timeout);
          this.roomCode = this.generateRoomCode();
          this.createRoom(nickname).then(resolve).catch(reject);
        } else if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ roomCode: this.roomCode, myId: this.myId, isHost: true });
        }
      });
    });
  }

  setupHostConnection(conn) {
    conn.on('open', () => {
      conn.on('data', (data) => {
        if (!data || typeof data !== 'object') return;
        if (data.senderId) {
          this.connections.set(data.senderId, conn);
        }
        this.handleIncomingPacket(data);
      });
    });

    conn.on('close', () => {
      for (const [pid, c] of this.connections.entries()) {
        if (c === conn) {
          this.connections.delete(pid);
          if (this.callbacks.onPlayerLeave) {
            this.callbacks.onPlayerLeave(pid);
          }
          break;
        }
      }
    });
  }

  /**
   * 방 코드로 입장하기 (게스트)
   */
  async joinRoom(rawCode, nickname) {
    this.cleanupPeer();
    this.isHost = false;
    this.roomCode = rawCode.trim().toUpperCase();
    this.myNickname = nickname || '플레이어';

    if (!this.roomCode) {
      throw new Error('방 코드를 입력해줘!');
    }

    const hostPeerId = `${ROOM_PREFIX}${this.roomCode}`;

    return new Promise((resolve, reject) => {
      let settled = false;

      const finishJoin = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ roomCode: this.roomCode, myId: this.myId, isHost: false });
      };

      const failJoin = (msg) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(msg));
      };

      const timer = setTimeout(() => {
        failJoin(`방(${this.roomCode})을 찾을 수 없거나 응답이 없어!`);
      }, 6500);

      // 1) BroadcastChannel로도 동시에 JOIN 요청 전송 (같은 브라우저 탭이나 로컬 테스트 시 0ms 연결)
      this.sendViaBroadcast({
        type: 'JOIN_REQ',
        roomCode: this.roomCode,
        senderId: this.myId,
        nickname: this.myNickname
      });

      // 호스트로부터 JOIN_ACK를 받으면 완료 처리
      this._onJoinAck = () => {
        finishJoin();
      };

      // 2) PeerJS WebRTC 연결 시도
      if (typeof window.Peer !== 'undefined') {
        try {
          this.peer = new window.Peer({ debug: 1 });
          this.peer.on('open', () => {
            const conn = this.peer.connect(hostPeerId, { reliable: true });
            this.hostConn = conn;

            conn.on('open', () => {
              conn.send({
                type: 'JOIN_REQ',
                roomCode: this.roomCode,
                senderId: this.myId,
                nickname: this.myNickname
              });
            });

            conn.on('data', (data) => {
              this.handleIncomingPacket(data);
            });

            conn.on('close', () => {
              if (this.callbacks.onHostDisconnected) {
                this.callbacks.onHostDisconnected();
              }
            });

            conn.on('error', (err) => {
              console.warn('Guest conn error:', err);
            });
          });

          this.peer.on('error', (err) => {
            console.warn('PeerJS Guest error:', err);
            if (err.type === 'peer-unavailable') {
              // 만약 같은 브라우저 BroadcastChannel 응답도 없다면 잠시 후 실패 처리
              setTimeout(() => {
                if (!settled) {
                  failJoin(`코드 [${this.roomCode}] 방이 존재하지 않아!`);
                }
              }, 800);
            }
          });
        } catch (e) {
          console.warn('Peer init error:', e);
        }
      }
    });
  }

  /**
   * 호스트 -> 모든 게스트에게 패킷 브로드캐스트
   */
  broadcastFromHost(packet) {
    if (!this.isHost) return;
    const msg = {
      ...packet,
      roomCode: this.roomCode,
      fromHost: true
    };

    // WebRTC 연결된 모든 피어에 전송
    for (const conn of this.connections.values()) {
      if (conn && conn.open) {
        try {
          conn.send(msg);
        } catch (e) {
          console.warn('Peer send failed:', e);
        }
      }
    }

    // 로컬 BroadcastChannel로도 전송
    this.sendViaBroadcast(msg);
  }

  /**
   * 게스트 -> 호스트에게 패킷 전송 (내가 호스트면 즉시 로컬 처리)
   */
  sendToHost(packet) {
    const msg = {
      ...packet,
      roomCode: this.roomCode,
      senderId: this.myId
    };

    if (this.isHost) {
      this.handleIncomingPacket(msg);
      return;
    }

    if (this.hostConn && this.hostConn.open) {
      try {
        this.hostConn.send(msg);
      } catch (e) {
        console.warn('Host send failed:', e);
      }
    }

    this.sendViaBroadcast(msg);
  }

  sendViaBroadcast(msg) {
    if (!this.bc) return;
    try {
      this.bc.postMessage(msg);
    } catch (_) {}
  }

  handleBroadcastMessage(data) {
    if (!data || data.roomCode !== this.roomCode) return;
    // 내가 보낸 메시지는 무시
    if (data.senderId === this.myId && !data.fromHost) return;
    if (this.isHost && data.fromHost) return;
    if (!this.isHost && !data.fromHost) return;

    this.handleIncomingPacket(data);
  }

  handleIncomingPacket(data) {
    if (!data || data.roomCode !== this.roomCode) return;

    // 중복 패킷 방지 (PeerJS와 BroadcastChannel 양쪽으로 올 수 있음)
    if (data._packetId) {
      if (this._lastPacketIds && this._lastPacketIds.has(data._packetId)) {
        return;
      }
      if (!this._lastPacketIds) this._lastPacketIds = new Set();
      this._lastPacketIds.add(data._packetId);
      if (this._lastPacketIds.size > 200) {
        const first = this._lastPacketIds.values().next().value;
        this._lastPacketIds.delete(first);
      }
    }

    if (!this.isHost && data.type === 'ROOM_STATE') {
      if (this._onJoinAck) {
        const fn = this._onJoinAck;
        this._onJoinAck = null;
        fn();
      }
    }

    if (this.callbacks.onPacket) {
      this.callbacks.onPacket(data);
    }
  }
}
