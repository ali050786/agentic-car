import { generateSignatureCard } from '../utils/signatureCardGenerator';
import { BrandingConfig } from '../types';

// Test data
const testCard: BrandingConfig = {
    enabled: true,
    name: 'Sikandar Ali Abdul',
    title: 'UX Lead',
    imageUrl: 'https://images.unsplash.com/photo-1695927621677-ec96e048dce2?q=80&w=870',
    position: 'bottom-left'
};

console.log('Testing Signature Card Generation...\n');

// Test bottom-left position with Lato
console.log('1. Bottom-Left (Lato):');
console.log(generateSignatureCard(testCard, 'Lato', 'portrait'));
console.log('\n---\n');

// Test top-left position with Lato
console.log('2. Top-Left (Lato):');
testCard.position = 'top-left';
console.log(generateSignatureCard(testCard, 'Lato', 'portrait'));
console.log('\n---\n');

// Test top-right position with Roboto
console.log('3. Top-Right (Roboto):');
testCard.position = 'top-right';
console.log(generateSignatureCard(testCard, 'Roboto', 'portrait'));
console.log('\n---\n');

console.log('✅ All tests completed!');
