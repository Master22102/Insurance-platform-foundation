# Section 7.2-adjacent — OAuth transparency microcopy (optional email import)

**Context:** Subsection governing optional inbox connection for **incident-related evidence import**.

## Intent

- Reduce anxiety around email access  
- Clarify scope and limitations  
- Reinforce user control  
- Avoid minimizing seriousness  
- Avoid gimmicks or exaggerated branding claims  
- **Tone:** calm, transparent, factual  

## Scope disclosure requirements

When prompting for inbox connection, clearly communicate:

1. Access is **read-only**.  
2. The platform **cannot** send, delete, or modify emails.  
3. The platform does **not** scan the **entire** inbox.  
4. Searches are limited to **incident-related** matches.  
5. The user can **revoke** access at any time.  
6. **Polling** (if enabled) is limited to **24 hours**.  

## Required transparency copy (template)

> We’ll connect securely to look only for messages related to this trip.  
> We can’t send, delete, or change anything in your inbox.  
> We’ll search only for replies connected to this incident.  
> You can disconnect at any time.

## Optional time-boxed polling disclosure

If enabled:

> We’ll check for the airline’s reply for the next 24 hours and attach it automatically if it arrives.  
> You can turn this off at any time.

Polling must automatically stop after:

- 24 hours  
- Successful import  
- User revocation  

## UX behavior requirements

- Progress indicator during OAuth handshake  
- No dark patterns  
- No pressure language  
- Visible **Disconnect** control  
- **Last checked** timestamp in incident timeline  

## Prohibited language

- “We scan your inbox”  
- “Full access”  
- “Continuous monitoring”  
- Fear-based messaging  
- Minimizing security concerns  

## Low-bandwidth mode (7.6 cross-reference)

If connectivity is unstable:

- Provide **manual upload** fallback immediately  
- Avoid repeated failed connection loops  
- Preserve user trust over automation preference  

## Evidence & documentation screen (7.3 cross-reference)

**Evidence & Documentation Screen** (F-6.5.6) lists email import (read-only) and must follow these OAuth transparency standards (Section 7.2 / this document).
