from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class Card(BaseModel):
    """
    Card model for representing swipeable content in the system.
    Includes fields for tracking user interactions and maintaining ELO-based rankings.
    """
    
    # Core card fields
    id: str = Field(..., description="Unique identifier for the card")
    title: str = Field(..., description="Title or main text of the card")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp when the card was created")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp of last update to the card")
    
    # Swipe interaction tracking
    likes_count: int = Field(default=0, description="Number of right swipes (likes) received")
    dislikes_count: int = Field(default=0, description="Number of left swipes (dislikes) received")
    total_interactions: int = Field(default=0, description="Total number of swipe interactions")
    last_interaction_at: Optional[datetime] = Field(
        default=None, 
        description="Timestamp of the most recent swipe interaction"
    )
    
    # ELO ranking properties
    elo_rating: float = Field(
        default=1500.0,  # Standard initial ELO rating
        description="Current ELO rating of the card"
    )
    elo_k_factor: float = Field(
        default=32.0,  # Standard K-factor for ELO calculations
        description="K-factor used in ELO calculations, determines rating volatility"
    )
    confidence_score: float = Field(
        default=0.0,
        description="Confidence in the current ELO rating based on number of interactions"
    )
    
    def update_interaction_counts(self, is_like: bool) -> None:
        """
        Updates interaction counts when a new swipe occurs.
        
        Args:
            is_like (bool): True if the interaction was a right swipe (like),
                          False if it was a left swipe (dislike)
        """
        if is_like:
            self.likes_count += 1
        else:
            self.dislikes_count += 1
        
        self.total_interactions += 1
        self.last_interaction_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def calculate_win_probability(self, opponent_rating: float) -> float:
        """
        Calculates the expected win probability against an opponent based on ELO ratings.
        
        Args:
            opponent_rating (float): The ELO rating of the opponent card
            
        Returns:
            float: Expected probability of winning (0-1)
        """
        return 1.0 / (1.0 + 10.0 ** ((opponent_rating - self.elo_rating) / 400.0))
    
    def update_elo_rating(self, opponent_rating: float, won: bool) -> None:
        """
        Updates the card's ELO rating after an interaction.
        
        Args:
            opponent_rating (float): The ELO rating of the opponent card
            won (bool): True if this card was preferred in the interaction,
                       False if the opponent was preferred
        """
        expected_score = self.calculate_win_probability(opponent_rating)
        actual_score = 1.0 if won else 0.0
        
        # Update ELO rating
        self.elo_rating += self.elo_k_factor * (actual_score - expected_score)
        
        # Update confidence score based on total interactions
        self.confidence_score = min(1.0, self.total_interactions / 100.0)
        
        self.updated_at = datetime.utcnow()
    
    def get_ranking_score(self) -> float:
        """
        Calculates a composite ranking score that considers both ELO rating
        and confidence based on interaction count.
        
        Returns:
            float: The composite ranking score
        """
        # Weight the ELO rating by confidence score to avoid premature high rankings
        return self.elo_rating * self.confidence_score
