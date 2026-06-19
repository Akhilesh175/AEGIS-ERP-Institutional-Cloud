#!/bin/bash
# AEGIS ERP Deploy Script
echo "Staging files..."
git add supabase/migrations/20260611234500_add_warden_id_to_hostel_blocks.sql \
        src/types/index.ts \
        src/services/mockApi.ts \
        src/portals/StudentPortal.tsx \
        src/portals/ParentPortal.tsx

echo "Committing fixes..."
git commit -m "Fix Hostel Warden Details Visibility in Student & Parent Portals"

echo "Pushing changes to trigger Vercel deployment..."
git push

echo "Deployment triggered successfully!"
