# Deployed production snapshot — v57b

Recorded 2026-10-25 before the proposed v60 rollout.

- Production manifest SHA-256: `309c04c79a22058188487f07b6a283e3793e0497e01054f6252ca0f680a19b21`.
- Read-only live verification matched the complete deployed output to that manifest.
- All 138 build inputs in this source snapshot match the successful frozen build proof. The original 113 manifest source entries also match.
- Tests and documentation are from the retained v57b source tree; they are not represented as hashed runtime build inputs.
- The release ZIP contains only the 37 frozen output files and their manifest, with no rebuild.
- This is source/release preservation, not a database backup, a new deployment, or a claim that all known defects are fixed.
- Live data, passwords, sessions, receipts, vaults, private operational tools and access files are excluded. Existing synthetic examples remain synthetic.
- The newer v56/v58/v59/v60 staging changes are intentionally excluded from this production snapshot.

Use isolated synthetic data and disabled external integrations for testing. Never start development commands against production data.
