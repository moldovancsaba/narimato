// Run this in the browser console on your result page to test hierarchical detection

async function testHierarchicalFlow() {
  console.log('🧪 Testing Hierarchical Session Detection...');
  
  // Get the current session ID (you might need to extract this from the URL or page)
  const parentSessionId = '486ea3f5-96bd-47ca-be65-0c8d1c3cf5b4'; // Your current parent session
  
  try {
    // Check hierarchical status
    const response = await fetch(`/api/play/hierarchical-status?playId=${parentSessionId}`);
    const data = await response.json();
    
    console.log('📤 Hierarchical Status Response:');
    console.log('  Is Hierarchical:', data.isHierarchical);
    console.log('  Action:', data.action);
    console.log('  Status:', data.status);
    console.log('  Phase:', data.hierarchicalPhase);
    
    if (data.isHierarchical && data.action === 'start_child_session') {
      console.log('✅ Child session found!');
      console.log('  Child Session ID:', data.data.childSessionId);
      console.log('  Family:', data.data.parentName);
      console.log('  Message:', data.data.message);
      console.log('  Cards to rank:', data.data.cards.map(c => c.title).join(' vs '));
      
      console.log('\n🎯 REDIRECTING TO CHILD SESSION...');
      console.log(`  URL: /play/${data.data.childSessionId}`);
      
      // Show confirmation dialog
      if (confirm(`${data.data.message}\n\nRedirect to rank ${data.data.parentName} family?`)) {
        window.location.href = `/play/${data.data.childSessionId}`;
      }
    } else {
      console.log('❌ No child session found or not hierarchical');
      console.log('Full response:', data);
    }
  } catch (error) {
    console.error('❌ Error checking hierarchical status:', error);
  }
}

// Run the test
testHierarchicalFlow();
