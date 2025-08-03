import { SESSION_FIELDS, CARD_FIELDS } from '@/app/lib/constants/fieldNames';

class SessionManager {
  private playId: string | null = null;
  private currentCard: string | null = null;

  initialize(playId: string) {
    this.playId = playId;
    this.currentCard = null;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(SESSION_FIELDS.ID, playId);
  }

  updateCurrentCard(cardId: string) {
    this.currentCard = cardId;
    localStorage.setItem(CARD_FIELDS.ID, cardId);
  }

  clear() {
    this.playId = null;
    this.currentCard = null;
    localStorage.clear();
    sessionStorage.clear();
  }

  getCurrentCard() {
    return this.currentCard;
  }

  isSessionComplete() {
    // Mock logic for simplicity - implement according to session completion business rules
    return this.playId != null && this.currentCard === null;
  }
}

const sessionManager = new SessionManager();

export default sessionManager;
