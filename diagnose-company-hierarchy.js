// FUNCTIONAL: Diagnoses company hierarchy issues and prevents circular references
// STRATEGIC: Ensures SwipeMore works correctly by fixing parent-child relationships safely

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const ORG_ID = 'be34910d-fc7b-475b-8112-67fe778bff2c';
const Card = require('./lib/models/Card.js');

async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  }
}

async function diagnoseAndFix() {
  await connectDB();
  
  console.log('🔍 DIAGNOSING COMPANY HIERARCHY ISSUE\n');
  
  try {
    // Get all cards from this organization
    const allCards = await Card.find({ 
      organizationId: ORG_ID, 
      isActive: true 
    }).sort({ name: 1 });
    
    console.log(`Found ${allCards.length} total cards\n`);
    
    // Show current structure
    console.log('📊 CURRENT CARD STRUCTURE:\n');
    allCards.forEach(card => {
      console.log(`${card.name} (${card.title})`);
      console.log(`  parentTag: "${card.parentTag || 'ROOT'}"`);
      console.log(`  isParent: ${card.isParent}, hasChildren: ${card.hasChildren}`);
      console.log('');
    });
    
    // Check for company hierarchy specifically
    console.log('🏢 COMPANY HIERARCHY ANALYSIS:\n');
    
    const companyChildren = allCards.filter(card => card.parentTag === 'company');
    console.log(`Cards with parentTag="company": ${companyChildren.length}`);
    companyChildren.forEach(card => {
      console.log(`  - ${card.name} (${card.title})`);
    });
    console.log('');
    
    const salesChildren = allCards.filter(card => card.parentTag === 'sales');
    console.log(`Cards with parentTag="sales": ${salesChildren.length}`);
    salesChildren.forEach(card => {
      console.log(`  - ${card.name} (${card.title})`);
    });
    console.log('');
    
    const productChildren = allCards.filter(card => card.parentTag === 'product');
    console.log(`Cards with parentTag="product": ${productChildren.length}`);
    productChildren.forEach(card => {
      console.log(`  - ${card.name} (${card.title})`);
    });
    console.log('');
    
    // Detect circular references
    console.log('🔍 CHECKING FOR CIRCULAR REFERENCES:\n');
    const circularIssues = [];
    
    allCards.forEach(card => {
      // Check if card is its own parent
      if (card.parentTag === card.name) {
        circularIssues.push({
          type: 'self-parent',
          card: card.name,
          issue: `Card "${card.name}" has itself as parent`
        });
      }
      
      // Check for deeper circular references
      const visited = new Set();
      let current = card;
      
      while (current.parentTag && !visited.has(current.name)) {
        visited.add(current.name);
        const parentCard = allCards.find(c => c.name === current.parentTag);
        
        if (parentCard) {
          if (parentCard.name === card.name) {
            circularIssues.push({
              type: 'circular-chain',
              card: card.name,
              issue: `Circular reference chain detected: ${Array.from(visited).join(' → ')} → ${card.name}`
            });
            break;
          }
          current = parentCard;
        } else {
          break;
        }
      }
    });
    
    if (circularIssues.length > 0) {
      console.log('❌ CIRCULAR REFERENCE ISSUES FOUND:');
      circularIssues.forEach(issue => {
        console.log(`  ${issue.type}: ${issue.issue}`);
      });
    } else {
      console.log('✅ NO CIRCULAR REFERENCES FOUND');
    }
    console.log('');
    
    // Fix isParent and hasChildren flags
    console.log('🔧 FIXING PARENT FLAGS:\n');
    
    let fixedCount = 0;
    
    for (const card of allCards) {
      const children = allCards.filter(c => c.parentTag === card.name);
      const shouldBeParent = children.length > 0;
      
      if (card.isParent !== shouldBeParent || card.hasChildren !== shouldBeParent) {
        console.log(`Fixing ${card.name}:`);
        console.log(`  Children count: ${children.length}`);
        console.log(`  Old flags: isParent=${card.isParent}, hasChildren=${card.hasChildren}`);
        console.log(`  New flags: isParent=${shouldBeParent}, hasChildren=${shouldBeParent}`);
        
        await Card.findOneAndUpdate(
          { uuid: card.uuid },
          { 
            isParent: shouldBeParent, 
            hasChildren: shouldBeParent 
          }
        );
        
        fixedCount++;
        console.log('  ✅ Fixed\n');
      }
    }
    
    if (fixedCount === 0) {
      console.log('✅ All parent flags are already correct\n');
    } else {
      console.log(`✅ Fixed ${fixedCount} cards\n`);
    }
    
    // Final verification
    console.log('🎯 FINAL HIERARCHY VERIFICATION:\n');
    
    const updatedCards = await Card.find({ 
      organizationId: ORG_ID, 
      isActive: true 
    }).sort({ name: 1 });
    
    const hierarchyLevels = {
      'ROOT': updatedCards.filter(c => !c.parentTag),
      'company': updatedCards.filter(c => c.parentTag === 'company'),
      'sales': updatedCards.filter(c => c.parentTag === 'sales'),
      'product': updatedCards.filter(c => c.parentTag === 'product'),
      'marketing': updatedCards.filter(c => c.parentTag === 'marketing')
    };
    
    Object.entries(hierarchyLevels).forEach(([level, cards]) => {
      if (cards.length > 0) {
        console.log(`${level} level (${cards.length} cards):`);
        cards.forEach(card => {
          const childCount = updatedCards.filter(c => c.parentTag === card.name).length;
          const flags = card.isParent ? `📁 PARENT(${childCount})` : '📄 LEAF';
          console.log(`  - ${card.name} (${card.title}) ${flags}`);
        });
        console.log('');
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

diagnoseAndFix().catch(console.error);
