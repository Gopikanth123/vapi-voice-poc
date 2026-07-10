# Google Sheets Tool — Setup Guide

## Step 1: Create Your Google Sheet

Create a new Google Sheet and name it something like **"Vesta Home — Lead Tracker"**.

### Header Row (Row 1) — Copy these exactly into cells A1 through P1:

| Column | Header | Description |
|--------|--------|-------------|
| **A** | `Timestamp` | Date & time the call happened |
| **B** | `Full Name` | Caller's full name |
| **C** | `Email` | Caller's email address |
| **D** | `Lead Type` | Homeowner / Realtor / Developer / Designer-Trade |
| **E** | `Service Interest` | Staging / Design / Rental / Purchase / Custom / Turnkey / Trade / Specialty |
| **F** | `Property Address` | Property address or city |
| **G** | `Property Type` | Single Family / Condo / Apartment / Luxury Estate |
| **H** | `Square Footage` | Approximate square footage |
| **I** | `Bedrooms` | Number of bedrooms |
| **J** | `Occupied or Vacant` | Whether property is occupied or vacant |
| **K** | `Project Details` | Key project scope notes (listing date, style prefs, rooms, etc.) |
| **L** | `Budget Range` | Estimated budget range |
| **M** | `Timeline` | Desired timeline or completion date |
| **N** | `Qualification Status` | Qualified / Needs Follow-Up / Not Qualified |
| **O** | `Consultation Date-Time` | Preferred consultation date, time, and timezone (if scheduled) |
| **P** | `Call Summary` | Brief 1-2 sentence summary of the call |

---

## Step 2: Get Your Spreadsheet ID

Your Spreadsheet ID is the long string in the Google Sheets URL:

```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_IS_HERE/edit
```

Copy that ID and paste it into the **Spreadsheet ID** field in VAPI.

---

## Step 3: Configure the Tool in VAPI

### Tool Name
```
google_sheets_tool
```

### Description (paste this into the Description field)
```
Saves lead qualification data from the call to a Google Sheet. Call this tool ONCE at the end of every call, right BEFORE triggering endCall. Pass all collected data as a single row. If any field was not collected, pass an empty string for that field.
```

### Range
```
Sheet1!A:P
```

> **IMPORTANT:** Make sure your sheet tab is named exactly **Sheet1** (the default). If you renamed it, use that name instead (e.g., `Leads!A:P`).

---

## Step 4: Configure the Tool Parameters

In VAPI, click the **</>** (code view) button on the tool to add parameters. The tool needs to know what data to append. Add these parameters:

```json
{
  "type": "object",
  "properties": {
    "timestamp": {
      "type": "string",
      "description": "Current date and time in ISO format (e.g., 2026-07-10T14:30:00)"
    },
    "full_name": {
      "type": "string",
      "description": "The caller's full name"
    },
    "email": {
      "type": "string",
      "description": "The caller's email address"
    },
    "lead_type": {
      "type": "string",
      "enum": ["Homeowner", "Realtor", "Developer", "Designer/Trade"],
      "description": "The type of lead"
    },
    "service_interest": {
      "type": "string",
      "description": "The service(s) the caller is interested in (e.g., Home Staging, Interior Design, Furniture Rental)"
    },
    "property_address": {
      "type": "string",
      "description": "Property address or city"
    },
    "property_type": {
      "type": "string",
      "description": "Type of property (Single Family, Condo, Apartment, Luxury Estate)"
    },
    "square_footage": {
      "type": "string",
      "description": "Approximate square footage of the property"
    },
    "bedrooms": {
      "type": "string",
      "description": "Number of bedrooms"
    },
    "occupied_or_vacant": {
      "type": "string",
      "description": "Whether the property is occupied or vacant"
    },
    "project_details": {
      "type": "string",
      "description": "Key project details like listing date, style preferences, rooms involved, specific needs"
    },
    "budget_range": {
      "type": "string",
      "description": "The caller's estimated budget range"
    },
    "timeline": {
      "type": "string",
      "description": "Desired timeline or completion date"
    },
    "qualification_status": {
      "type": "string",
      "enum": ["Qualified", "Needs Follow-Up", "Not Qualified"],
      "description": "The qualification status of the lead"
    },
    "consultation_datetime": {
      "type": "string",
      "description": "Preferred consultation date, time, and timezone if the lead was qualified and scheduled"
    },
    "call_summary": {
      "type": "string",
      "description": "A brief 1-2 sentence summary of the call"
    }
  },
  "required": ["timestamp", "full_name", "email", "lead_type", "qualification_status", "call_summary"]
}
```

---

## Step 5: Messages Configuration

Under the **Messages** section of the tool in VAPI, configure:

| Message Type | Suggested Text |
|-------------|----------------|
| **Request Start** | *(leave empty — don't say anything while saving)* |
| **Request Complete** | *(leave empty)* |
| **Request Failed** | "I've noted all your details — our team will have everything they need." |

> **TIP:** Keep messages empty/silent so the caller doesn't hear "saving your data" — it should happen invisibly in the background.

---

## Step 6: Set Tool to Async

In the tool's advanced settings, set **async: true** so the call doesn't hang while data is being saved to the sheet. This prevents dead air.

---

## Quick Summary of the Flow

```
Call ends → Ava triggers google_sheets_tool (saves all data) → Ava triggers endCall
```

The tool fires silently in the background. The caller never hears or notices it.
