# port def

/login', tokenauth.get.guest, administration.login);
/add-user', tokenauth.get.admin, administration.checkExistingEmail, administration.createNewUser, notifications.sendNewAdminUser);
/edit-user', tokenauth.get.admin, administration.editAdminUser);
/delete-admin-user', tokenauth.get.admin, administration.deleteAdminUser);
/fetch-administration-users', tokenauth.get.admin, administration.fetchAdminUsers);
/analytics/quick', tokenauth.get.admin, analytics.countResumes, analytics.countExpirations, analytics.countOrdersToday, analytics.sendQuick);
/analytics/orders', tokenauth.get.admin, analytics.fetchOrderData);
/analytics/full', tokenauth.get.admin, analytics.countResumes, analytics.countOrdersToday, analytics.countOrders, analytics.countEmployers, analytics.countActiveEmployers, analytics.countUsers, analytics.countListings, analytics.countApplications, analytics.sendFull);
/analytics/advanced', tokenauth.get.admin, analytics.getDS, analytics.getCSemployers, analytics.getCSemployerusers, analytics.getCSjobs, analytics.getCSresumes, analytics.getCSusers, analytics.getCSorders, analytics.sendAdvanced);
/fetch-appdata', tokenauth.get.admin, administration.fetchAppdata);// Test Covered
/fetch-announcements', tokenauth.get.admin, administration.fetchAnnouncements);
/create-announcement', tokenauth.get.admin, administration.createAnnouncement);
/remove-announcement', tokenauth.get.admin, administration.removeAnnouncement);
/fetch-content', tokenauth.get.admin, administration.fetchContent);
/fetch-orders', tokenauth.get.admin, administration.fetchOrders);
/fetch-listings', tokenauth.get.admin, administration.fetchListings);
/change-listing-status', tokenauth.get.admin, administration.setListingStatus, notifications.listingStatusChange);
/fetch-resumes', tokenauth.get.admin, administration.fetchResumes, administration.appendUser, administration.sendResults);
/fetch-employers', tokenauth.get.admin, administration.fetchEmployers, administration.appendAccount, administration.sendResults);
/delete-employer', tokenauth.get.admin, administration.deleteEmployerListing, administration.deleteEmployerAccount, notifications.deletedEmployer);
/fetch-users', tokenauth.get.admin, administration.fetchUsers);
/delete-user', tokenauth.get.admin, administration.deleteUserAccount, administration.deleteUserResume);
/update-content', tokenauth.get.admin, administration.updateContent);// Test Covered
/add-image-to-rotation', tokenauth.get.admin, administration.addImageToRotation);
/remove-image-from-rotation', tokenauth.get.admin, administration.removeImageFromRotation);
/employer/:id/update', tokenauth.get.admin, administration.updateEmployer);
/admin/feeds/register', tokenauth.get.admin, administration.registerFeed);
/admin/feeds', tokenauth.get.admin, administration.fetchFeeds);
/admin/feeds/remove', tokenauth.get.admin, administration.removeFeed);

/admin/activate', tokenauth.get.guest, administration.activateAccount);
