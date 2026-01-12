## ADDED Requirements

### Requirement: Keyword input UI
The system SHALL provide a minimal on-page toast UI that allows users to enter comma-separated lists of keywords to highlight and to strike through.

#### Scenario: User updates keywords
- **WHEN** the user enters new comma-separated lists and confirms
- **THEN** the highlights and strike-throughs update on the current page

### Requirement: Persistent keyword storage
The system SHALL persist the highlight and exclude lists per hostname so they survive page navigations.

#### Scenario: Navigation within a site
- **WHEN** the user navigates to another page on the same hostname
- **THEN** previously saved highlight and exclude lists are restored and applied automatically

### Requirement: Distinct highlight colors
The system SHALL assign a distinct, deterministic background color to each keyword.

#### Scenario: Multiple keywords
- **WHEN** multiple keywords are present on the page
- **THEN** each keyword is highlighted with its assigned color

### Requirement: Excluded term styling
The system SHALL render excluded terms with a strike-through style.

#### Scenario: Excluded terms present
- **WHEN** excluded keywords are present on the page
- **THEN** each excluded keyword is struck through in the rendered text

### Requirement: Dynamic page support
The system SHALL re-apply highlights when the page content changes without a full reload.

#### Scenario: SPA content update
- **WHEN** the page updates content dynamically
- **THEN** matching keywords in new content are highlighted
