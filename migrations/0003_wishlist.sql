-- Records imported without a campsite score were intended as a wish list.
UPDATE sites
SET status = 'wishlist', updated_at = CURRENT_TIMESTAMP
WHERE status = 'saved';
