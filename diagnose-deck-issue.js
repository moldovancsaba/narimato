#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDB } from './lib/db.js';
import Card from './lib/models/Card.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env.local') });

async function diagnoseDeckIssue() {
  console.log('🔍 DIAGNOSING DECK PLAYABILITY ISSUE');
  console.log('=====================================\n');
  
  try {
    await connectDB();
    const orgId = 'be34910d-fc7b-475b-8112-67fe778bff2c';
    
    // Get all cards
    const cards = await Card.find({ organizationId: orgId, isActive: true });
    console.log(`Found ${cards.length} total cards\n`);
    
    // Group by parentTag
    const deckGroups = {};
    cards.forEach(card => {
      if (card.parentTag) {
        if (!deckGroups[card.parentTag]) {
          deckGroups[card.parentTag] = { parents: [], children: [] };
        }
        if (card.isParent) {
          deckGroups[card.parentTag].parents.push({
            title: card.title,
            id: card.uuid
          });
        } else {
          deckGroups[card.parentTag].children.push({
            title: card.title,
            id: card.uuid
          });
        }
      }
    });
    
    console.log('DECK ANALYSIS:');
    console.log('==============');
    Object.entries(deckGroups).forEach(([tag, group]) => {
      const totalCards = group.parents.length + group.children.length;
      const isHierarchical = group.parents.length >= 2;
      const isSimplePlayable = group.children.length >= 2;
      
      console.log(`\n📦 DECK "${tag}":`);
      console.log(`   Total cards: ${totalCards}`);
      console.log(`   Parents (${group.parents.length}): ${group.parents.map(p => p.title).join(', ')}`);
      console.log(`   Children (${group.children.length}): ${group.children.map(c => c.title).join(', ')}`);
      
      if (isHierarchical) {
        console.log(`   ✅ HIERARCHICAL DECK (${group.parents.length} parents)`);
      } else if (isSimplePlayable) {
        console.log(`   ✅ SIMPLE DECK (${group.children.length} cards)`);
      } else {
        console.log(`   ❌ NOT PLAYABLE (need 2+ parents OR 2+ children)`);
      }
    });
    
    console.log('\n🔧 CURRENT isDeck() LOGIC:');
    console.log('=========================');
    console.log('Current logic only checks: isParent: true AND count >= 2');
    console.log('This means simple decks (like "0", "1", "2", "3") are not detected!');
    
    console.log('\n💡 SOLUTION NEEDED:');
    console.log('===================');
    console.log('Update isDeck() to check:');
    console.log('1. Hierarchical: 2+ parent cards (isParent: true)');
    console.log('2. OR Simple: 2+ child cards (any cards with that parentTag)');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

diagnoseDeckIssue();
