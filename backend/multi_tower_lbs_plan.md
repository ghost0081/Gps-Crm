# Implementation Plan: Multi-Tower (Neighboring Cells) LBS Integration

## Goal Description
The client hardware has been updated to send multiple neighboring cell towers (up to 5 or more) instead of a single serving cell tower. This allows for far more accurate indoor LBS triangulation. The data packet structure now contains a dynamic number of fields in the middle of the string, pushing the battery and charging information to the end.

## Proposed Changes

### 1. Update `backend/tracker-server.js`
We must update the `parseAsciiPacket` function to dynamically parse the variable-length string using index arithmetic.

*   **Fixed Headers (Indices 0-18):** Parse standard GPS coordinates, date, speed, heading, MCC, and MNC identically to before.
*   **Dynamic Cell Towers:** Create a loop that starts at index `19` and stops before the last 6 fields. Every 3 fields represent one tower:
    *   `LAC` (Hex -> Int)
    *   `CellID` (Hex -> Int)
    *   `Signal Strength` (Int)
*   **Fixed Tail (Last 6 indices):** Parse battery and charging parameters using `parts[parts.length - N]` to protect against varying tower counts.
    *   `battery` = `parseFloat(parts[parts.length - 3])`
*   Return a `cellTowers` array instead of just a single `cellId` and `lac`.
*   Update the `resolveCellLocation` call inside `tracker-server.js` to pass `mcc`, `mnc`, and the full `parsed.cellTowers` array.

### 2. Update `backend/services/lbs-service.js`
The current LBS service is hardcoded to accept a single `{ mcc, mnc, lac, cellId }`. We will update it to accept multiple towers to vastly improve indoor accuracy.

*   Change function signature to `async function resolveCellLocation({ mcc, mnc, cells })`.
*   **Mozilla Geolocation API Update:** Map the `cells` array into Mozilla's `cellTowers` format:
    ```javascript
    cellTowers: cells.map(c => ({
        mobileCountryCode: mcc || 404,
        mobileNetworkCode: mnc || 11,
        locationAreaCode: c.lac,
        cellId: c.cellId,
        signalStrength: c.signalStrength
    }))
    ```
*   **Unwired Labs API Update:** Map the `cells` array into Unwired Labs' format:
    ```javascript
    cells: cells.map(c => ({
        lac: c.lac,
        cid: c.cellId,
        signal: c.signalStrength
    }))
    ```

## Verification Plan
1. Simulate sending the new raw string `$M,864163085121037...` to the TCP server.
2. Verify that the parser extracts exactly 5 cell towers correctly from the payload without corrupting the battery reading (`64` from index `parts.length - 3`).
3. Verify that the LBS API resolves the multi-tower array to a highly accurate coordinate.
