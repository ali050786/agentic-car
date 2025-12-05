import { generateSignatureCard } from './utils/signatureCardGenerator';
import { SignatureCardData } from './types';

// Test data
const testCard: SignatureCardData = {
    name: 'Sikandar Ali Abdul',
    title: 'UX Lead',
    imageUrl: 'https://images.unsplash.com/photo-1695927621677-ec96e048dce2?q=80&w=870'
};

console.log('Testing Signature Card Generation...\n');

// Test bottom-left position with Lato
console.log('1. Bottom-Left (Lato):');
console.log(generateSignatureCard(testCard, 'bottom-left', 'Lato'));
console.log('\n---\n');

// Test top-left position with Lato
console.log('2. Top-Left (Lato):');
console.log(generateSignatureCard(testCard, 'top-left', 'Lato'));
console.log('\n---\n');

// Test top-right position with Roboto
console.log('3. Top-Right (Roboto):');
console.log(generateSignatureCard(testCard, 'top-right', 'Roboto'));
console.log('\n---\n');

console.log('✅ All tests completed!');
