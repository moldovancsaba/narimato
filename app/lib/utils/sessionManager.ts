import { CARD_FIELDS, SESSION_FIELDS } from '@/app/lib/constants/fieldNames';

class SessionManager {
  private sessionUUID: string | null = null;
  private currentCard: string | null = null;

  initialize(sessionUUID: string) {
    this.sessionUUID = sessionUUID;
    this.currentCard = null;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(SESSION_FIELDS.UUID, sessionUUID);
  }

  updateCurrentCard(cardUUID: string) {
    this.currentCard = cardUUID;
    localStorage.setItem(CARD_FIELDS.UUID, cardUUID);
  }

  clear() {
    this.sessionUUID = null;
    this.currentCard = null;
    localStorage.clear();
    sessionStorage.clear();
  }

  getCurrentCard() {
    return this.currentCard;
  }

  isSessionComplete() {
    // Mock logic for simplicity - implement according to session completion business rules
    return this.sessionUUID != null && this.currentCard === null;
  }
}

const sessionManager = new SessionManager();

export default sessionManager;
