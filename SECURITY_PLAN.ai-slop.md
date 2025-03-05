# Security Plan for Bear-Fit

This document outlines the security considerations and implementation plan for
the Bear-Fit application.

## Current Security Model

Bear-Fit currently operates with minimal security controls:

1. Events are accessed via a UUID in the URL parameter (`?id=<event-id>`)
2. Users are identified by a browser-generated ID stored in localStorage
3. No authentication is required to access or modify events
4. UI-level restrictions (e.g., showing the Import button only to creators) can
   be bypassed

## Security Concerns

### 1. Data Integrity Issues

- **Event Metadata Tampering**: Any user with the event ID can modify event
  properties (name, dates) through YDoc operations
- **Creator Impersonation**: No verification that a user is the actual creator
  when performing creator-only actions
- **Cross-User Data Modification**: Users can modify other users' availability
  data

### 2. Access Control Weaknesses

- **No Authentication**: No verification of user identity beyond
  client-generated IDs
- **No Authorization**: No enforcement of access control rules on the data level
- **No Validation**: Changes to YDoc are applied without validation or
  authorization checks

### 3. Import Functionality Risks

- **Data Overwriting**: An import operation could overwrite legitimate user data
- **Creator-only UI Control**: The import button is only hidden in the UI, but
  the functionality can be accessed programmatically

## Potential Solutions

### Short-term Approach (Client-side Validation)

1. **YDoc Change Validation**:

   - Implement `handleYDocChange(doc)` to validate and potentially revert
     unauthorized changes
   - Track original state and compare with changed state to identify
     unauthorized modifications
   - Revert changes that violate permission rules

   ```typescript
   handleYDocChange(doc: Doc): void {
     // Get the changed maps/elements
     const eventMap = doc.getMap("event");
     const availabilityMap = doc.getMap("availability");

     // Check creator-only operations
     if (this.wasEventMetadataChanged(eventMap) && !this.isCreator()) {
       this.revertEventChanges(eventMap);
     }

     // Check user-specific operations
     if (this.wasOtherUserDataChanged(availabilityMap)) {
       this.revertUnauthorizedAvailabilityChanges(availabilityMap);
     }
   }
   ```

2. **Change Tracking**:

   - Observe YDoc changes using Y.js observing APIs
   - Maintain a log of changes for audit purposes
   - Implement change rollback functionality for unauthorized changes

3. **Client-side Validation**:
   - Add validation rules that prevent UI from making unauthorized changes
   - Improve validation of imported JSON data to ensure it follows permission
     rules

### Medium-term Approach (Server-side Validation)

1. **PartyKit onBeforeConnect Validation**:

   - Implement basic validation in PartyKit's `onBeforeConnect` hook
   - Use the user ID in connection context for basic authorization

   ```typescript
   static async onBeforeConnect(request: Party.Request, lobby: Party.Lobby) {
     // Extract user ID from request
     const userId = new URL(request.url).searchParams.get("userId");

     // Add user ID to headers for use in onConnect
     request.headers.set("X-User-ID", userId || "anonymous");

     // Allow connection, but with user context for later validation
     return request;
   }
   ```

2. **YDoc Update Middleware**:

   - Implement middleware that validates YDoc updates before they're applied
   - Reject operations that violate permission rules

3. **Server-side Storage Validation**:
   - Add validation when loading/saving YDoc state to storage
   - Prevent corrupted or tampered states from being persisted

### Long-term Approach (Full Authentication)

1. **User Authentication**:

   - Implement proper authentication using PartyKit's authentication
     capabilities
   - Use JWT tokens for verifying user identity
   - Integrate with an auth provider like Clerk, Auth0, or Firebase Auth

   ```typescript
   // Client-side connection with auth token
   const partySocket = new PartySocket({
     host: PARTYKIT_HOST,
     room: eventId,
     query: async () => ({
       token: await getAuthToken() // Get token from auth provider
     })
   });

   // Server-side validation
   static async onBeforeConnect(request: Party.Request, lobby: Party.Lobby) {
     try {
       const token = new URL(request.url).searchParams.get("token");
       const decodedToken = await verifyToken(token);
       request.headers.set("X-User-ID", decodedToken.sub);
       return request;
     } catch (e) {
       return new Response("Unauthorized", { status: 401 });
     }
   }
   ```

2. **Login-gated Access Controls**:

   - Define clear roles (creator, participant)
   - Implement permission checks for all operations
   - Store role information in the YDoc

## Implementation Priority

For an approach that aligns with "non-paying anonymous users can have full write
access to events they have IDs for":

1. **Phase 1 - Basic Protection**:

   - Add event import validation to protect against data corruption
   - Improve UI to clearly show when modifications occur

2. **Phase 2 - Enhanced Visibility**:

   - Add audit logging of all changes
   - Implement change highlighting to show modifications by other users
   - Add conflict resolution for simultaneous edits

## Recommended Next Steps

1. Implement the `handleYDocChange` validation function to protect against the most critical data integrity issues
1. Add proper validation to the import functionality to prevent data corruption
2. Improve the UI to make it clear when changes are being made and by whom
3. Design a clean upgrade path from anonymous to authenticated usage for future
   monetization
