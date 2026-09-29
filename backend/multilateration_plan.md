# Positioning Logic Upgrade Plan

## Step 1: Codebase Audit & Problem Analysis
**Findings:** 
I have thoroughly audited the backend (`backend/services`, `backend/controllers`, etc.). Currently, there is **no custom mathematical triangulation code** running locally in your Node.js tracker. Instead, the backend (in `lbs-service.js`) forwards the array of cell towers directly to third-party APIs (Mozilla Geolocation and Unwired Labs) to perform the triangulation remotely.

**Why a standard "3-tower triangle" method breaks with 5 towers:**
A standard 3-tower method usually solves the geometric intersection of 3 circles. With exactly 3 towers, assuming perfect distances, the circles intersect at precisely one point. 
However, when you introduce 5 towers, real-world noise means those 5 circles will *never* perfectly intersect at a single point. It creates an **overdetermined system**. The strict geometric intersection logic fails because it cannot resolve the conflicting overlaps. To fix this, we must shift from geometric intersection to an optimization problem (Least-Squares) that finds the "best fit" point minimizing the error across all 5 circles.

---

## Step 2: Implementation Plan - Least-Squares Multilateration

I will implement a custom local solver (`backend/utils/multilateration.js`) without external dependencies.

1. **Projection:** Convert all tower `(lat, lon)` coordinates into a local flat Cartesian `(x, y)` plane (in meters), using the first tower as the `(0,0)` origin.
2. **Linearization:** We will take the circle equations $(x - x_i)^2 + (y - y_i)^2 = d_i^2$ and subtract the $N^{th}$ tower's equation from the rest. This cancels out the squared terms and creates a linear system of equations: $A \cdot x = b$.
3. **Initial Guess:** Solve $A \cdot x = b$ using a custom weighted Least-Squares matrix solver: $x = (A^T W A)^{-1} A^T W b$. Weights will be applied based on $1 / d^2$ or signal strength so closer towers have higher priority.
4. **Gauss-Newton Refinement:** Use the initial guess to run 5-10 iterations of the Gauss-Newton algorithm. This minimizes the non-linear residuals (the difference between the computed distance and the actual measured distance), drastically improving accuracy.
5. **Reverse Projection:** Convert the final localized `(x, y)` back into global `(lat, lon)`.

## Step 3: Bad Data & Outlier Handling
*   **Residual Calculation:** After the initial computation, the solver will check the residual error of each tower.
*   **Outlier Rejection:** If any tower's residual exceeds 2x the median residual, it will be flagged as an outlier, dropped from the array, and the system will re-solve automatically.
*   **Fallback Logic:** 
    * If circles don't intersect well or distances are wildly inaccurate, we fall back to a Weighted Centroid method.
    * If the usable tower count drops below 3, we gracefully return the best estimate (weighted average) with a much larger `accuracyRadiusMeters` penalty.
*   **Validation:** Reject any `NaN`, negative distances, or invalid coordinates before processing.

## Step 4: Output Structure
The function will rigidly return the required schema:
```javascript
{ 
    lat: 28.701538, 
    lon: 77.169090, 
    accuracyRadiusMeters: 14.5, // RMS of the final residuals
    towersUsed: 4, 
    towersRejected: 1 
}
```

## Step 5: Verification (Unit Tests)
I will write an independent test file (`backend/test-multilateration.js`) covering:
1. **3 towers exact:** Perfect intersection.
2. **5 towers exact:** Perfect intersection.
3. **5 towers with noise:** Realistic scenario with slight distance inaccuracies.
4. **5 towers with one outlier:** Ensures the outlier rejection successfully drops the bad tower and re-solves.
*The test will output the Expected vs. Computed position and the error in meters.*

---
**Status:** Awaiting your approval to proceed with writing the code for Steps 2-5!
