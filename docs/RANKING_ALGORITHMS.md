# Ranking algorithms (v7.2)

## Global (ELO)

- **Storage:** `Card.globalScore`, `voteCount`, `winCount` (`lib/models/Card.js`)
- **Logic:** `lib/utils/ranking.js` — `calculateELO`, `updateGlobalRankings`
- **Trigger:** Vote outcomes in `VoteOnlyService` (and related vote paths)

## Personal — unified v1 vote modes

- **Engine:** `VoteOnlyService` (`lib/services/VoteOnlyService.js`)
- **API:** `POST /api/v1/play/start` with `mode: vote_only` (and vote segments in other modes)
- **Mechanism:** Challenger/opponent flow with `rankedDeck` / `unrankedDeck`; not `BinarySearchEngine`

## Personal — swipe modes

- **Engines:** `SwipeOnlyEngine`, `SwipeMoreEngine`, `RankOnlyEngine`, `RankMoreEngine`
- **Persistence:** Mode-specific models (`SwipeOnlyPlay`, etc.) via `PlayDispatcher`

## Legacy

- **`DecisionTreeEngine`:** `/api/play/*` classic path
- **`BinarySearchEngine`:** Used inside `DecisionTreeService`; not wired to unified v1 dispatcher

## Results `mode` field

Engines return `snake_case` mode strings (e.g. `swipe_only`, `vote_more`) aligned with start API.
