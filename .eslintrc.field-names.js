module.exports = {
  rules: {
    // Custom rule to enforce usage of field constants
    'field-naming-consistency': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Enforce consistent field naming using centralized constants',
          category: 'Best Practices',
        },
        fixable: 'code',
        schema: [],
      },
      create(context) {
        const sourceCode = context.getSourceCode();
        
        // Common field name variations that should use constants
        const fieldPatterns = [
          { pattern: /'sessionId'|"sessionId"/, constant: 'SESSION_FIELDS.ID', message: 'Use SESSION_FIELDS.ID instead of hardcoded "sessionId"' },
          { pattern: /'cardId'|"cardId"/, constant: 'CARD_FIELDS.ID', message: 'Use CARD_FIELDS.ID instead of hardcoded "cardId"' },
          { pattern: /'uuid'|"uuid"/, constant: 'CARD_FIELDS.UUID', message: 'Use CARD_FIELDS.UUID instead of hardcoded "uuid"' },
          { pattern: /'cardA'|"cardA"/, constant: 'VOTE_FIELDS.CARD_A', message: 'Use VOTE_FIELDS.CARD_A instead of hardcoded "cardA"' },
          { pattern: /'cardB'|"cardB"/, constant: 'VOTE_FIELDS.CARD_B', message: 'Use VOTE_FIELDS.CARD_B instead of hardcoded "cardB"' },
          { pattern: /'winner'|"winner"/, constant: 'VOTE_FIELDS.WINNER', message: 'Use VOTE_FIELDS.WINNER instead of hardcoded "winner"' },
          { pattern: /'direction'|"direction"/, constant: 'VOTE_FIELDS.DIRECTION', message: 'Use VOTE_FIELDS.DIRECTION instead of hardcoded "direction"' },
          { pattern: /'personalRanking'|"personalRanking"/, constant: 'VOTE_FIELDS.PERSONAL_RANKING', message: 'Use VOTE_FIELDS.PERSONAL_RANKING instead of hardcoded "personalRanking"' },
          { pattern: /'version'|"version"/, constant: 'SESSION_FIELDS.VERSION', message: 'Use SESSION_FIELDS.VERSION instead of hardcoded "version"' },
          { pattern: /'timestamp'|"timestamp"/, constant: 'VOTE_FIELDS.TIMESTAMP', message: 'Use VOTE_FIELDS.TIMESTAMP instead of hardcoded "timestamp"' },
          { pattern: /'success'|"success"/, constant: 'API_FIELDS.SUCCESS', message: 'Use API_FIELDS.SUCCESS instead of hardcoded "success"' },
          { pattern: /'error'|"error"/, constant: 'API_FIELDS.ERROR', message: 'Use API_FIELDS.ERROR instead of hardcoded "error"' },
        ];

        return {
          Property(node) {
            if (node.key.type === 'Literal' && typeof node.key.value === 'string') {
              const keyValue = node.key.value;
              
              // Check if this property key matches any of our field patterns
              const matchedPattern = fieldPatterns.find(({ pattern }) => 
                pattern.test(`"${keyValue}"`)
              );

              if (matchedPattern) {
                context.report({
                  node: node.key,
                  message: matchedPattern.message,
                  fix(fixer) {
                    // Generate computed property syntax
                    return fixer.replaceText(node.key, `[${matchedPattern.constant}]`);
                  },
                });
              }
            }
          },
          
          MemberExpression(node) {
            if (node.property.type === 'Identifier') {
              const propertyName = node.property.name;
              
              // Check common object property accesses
              const commonFieldAccess = [
                { field: 'sessionId', constant: 'SESSION_FIELDS.ID' },
                { field: 'cardId', constant: 'CARD_FIELDS.ID' },
                { field: 'uuid', constant: 'CARD_FIELDS.UUID' },
                { field: 'personalRanking', constant: 'VOTE_FIELDS.PERSONAL_RANKING' },
                { field: 'version', constant: 'SESSION_FIELDS.VERSION' },
              ];

              const matchedField = commonFieldAccess.find(({ field }) => field === propertyName);
              
              if (matchedField && !node.computed) {
                context.report({
                  node: node.property,
                  message: `Consider using computed property access with ${matchedField.constant} for consistency`,
                  fix(fixer) {
                    return [
                      fixer.insertTextBefore(node.property, `[${matchedField.constant}]`),
                      fixer.remove(node.property)
                    ];
                  },
                });
              }
            }
          },

          CallExpression(node) {
            // Check localStorage.getItem and localStorage.setItem calls
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.object.name === 'localStorage' &&
              (node.callee.property.name === 'getItem' || node.callee.property.name === 'setItem')
            ) {
              const firstArg = node.arguments[0];
              if (firstArg && firstArg.type === 'Literal' && firstArg.value === 'sessionId') {
                context.report({
                  node: firstArg,
                  message: 'Use SESSION_FIELDS.ID for localStorage keys',
                  fix(fixer) {
                    return fixer.replaceText(firstArg, 'SESSION_FIELDS.ID');
                  },
                });
              }
            }

            // Check fetch URL construction
            if (node.callee.name === 'fetch' && node.arguments.length > 0) {
              const urlArg = node.arguments[0];
              if (urlArg.type === 'TemplateLiteral') {
                // Check template literal for hardcoded field names in query strings
                urlArg.quasis.forEach((quasi, index) => {
                  const text = quasi.value.cooked;
                  if (text.includes('sessionId=') || text.includes('cardId=')) {
                    context.report({
                      node: quasi,
                      message: 'Use field constants in URL query parameters',
                    });
                  }
                });
              }
            }
          }
        };
      },
    },
  },
};
