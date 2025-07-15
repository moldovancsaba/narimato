export function validateCard(card) {
  const errors = {};

  if (!card.title) {
    errors.title = 'Title is required';
  }

  if (!card.content) {
    errors.content = 'Content is required';
  }

  if (!card.projectId) {
    errors.projectId = 'Project ID is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
