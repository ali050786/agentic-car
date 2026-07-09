import dns from 'dns';
import { promisify } from 'util';

const resolveDns = promisify(dns.resolve);
const lookupDns = promisify(dns.lookup);

function ipInCidr(ip: string, cidr: string): boolean {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    
    if (ip.includes('.') && range.includes('.')) {
        const ipParts = ip.split('.').map(Number);
        const rangeParts = range.split('.').map(Number);
        
        let ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
        let rangeNum = (rangeParts[0] << 24) + (rangeParts[1] << 16) + (rangeParts[2] << 8) + rangeParts[3];
        
        const mask = ~(2 ** (32 - bits) - 1);
        return (ipNum & mask) === (rangeNum & mask);
    }
    return false;
}

const PRIVATE_CIDRS = [
    '127.0.0.0/8',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '169.254.0.0/16',
    '0.0.0.0/8'
];

/**
 * Validates a URL to prevent Server-Side Request Forgery (SSRF).
 * Resolves the host DNS and checks against private/loopback IP address ranges.
 */
export async function isSafeUrl(urlObj: URL): Promise<boolean> {
    const hostname = urlObj.hostname;
    
    // Direct block of common local hostnames
    if (
        hostname === 'localhost' || 
        hostname.endsWith('.local') || 
        hostname.endsWith('.internal') ||
        hostname === '[::1]'
    ) {
        return false;
    }
    
    try {
        // Resolve host to IP addresses
        let ips: string[] = [];
        try {
            ips = await resolveDns(hostname);
        } catch {
            // Fallback lookup
            const result = await lookupDns(hostname);
            ips = [result.address];
        }
        
        for (const ip of ips) {
            // Check IPv4 CIDRs
            for (const cidr of PRIVATE_CIDRS) {
                if (ipInCidr(ip, cidr)) return false;
            }
            
            // Check IPv6 Private/Loopback prefixes
            if (ip.includes(':')) {
                const norm = ip.toLowerCase();
                if (
                    norm === '::1' || 
                    norm.startsWith('fc') || 
                    norm.startsWith('fd') || 
                    norm.startsWith('fe8') ||
                    norm.startsWith('fe9') ||
                    norm.startsWith('fea') ||
                    norm.startsWith('feb')
                ) {
                    return false;
                }
            }
        }
        return true;
    } catch {
        return false; // Reject unresolved hosts
    }
}
