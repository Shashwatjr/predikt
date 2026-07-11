# Privacy Rights Workflow

User flow:

1. User submits a privacy request through `POST /privacy/requests`.
2. User can review submitted items through `GET /privacy/requests/me`.
3. User consent history is recorded through `POST /consents` and `GET /consents/me`.

Admin flow:

1. Privacy team reviews requests through `GET /admin/privacy-requests`.
2. Admin updates status through `PATCH /admin/privacy-requests/:privacyRequestId`.
3. Request status changes are audit logged.

Current MVP+ limitation:

- export generation is placeholder-only
- delete/anonymize workflow is not fully automated yet
