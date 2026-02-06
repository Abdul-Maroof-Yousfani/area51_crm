import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, appId } from '../lib/firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);

      if (authUser && authUser.email) {
        try {
          // Check if user is in allowed_users collection
          const allowedUserRef = doc(
            db,
            'artifacts',
            appId,
            'public',
            'data',
            'allowed_users',
            authUser.email
          );
          const allowedUserSnap = await getDoc(allowedUserRef);

          if (allowedUserSnap.exists()) {
            const userData = allowedUserSnap.data();
            setActiveUser({
              uid: authUser.uid,
              email: authUser.email,
              name: userData.name || authUser.displayName || 'User',
              role: userData.role || 'Sales'
            });
            setAuthError(null);
          } else {
            // User authenticated but not in allowed list
            setActiveUser(null);
            setAuthError('Your account is not authorized. Please contact the administrator.');
          }
        } catch (error) {
          console.error('Error checking user authorization:', error);
          setAuthError('Error verifying authorization.');
          setActiveUser(null);
        }
      } else if (authUser && !authUser.email) {
        // Anonymous user - not allowed for this app
        setActiveUser(null);
        setAuthError(null);
      } else {
        setActiveUser(null);
        setAuthError(null);
      }

      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // For development/emergency access only
  const forceAdminLogin = () => {
    setActiveUser({ name: 'Super Admin', role: 'Admin', uid: 'debug-admin' });
    setUser({ uid: 'debug-admin', email: 'admin@debug.com' });
    setAuthError(null);
    setAuthLoading(false);
  };

  return {
    user,
    activeUser,
    setActiveUser,
    authLoading,
    authError,
    forceAdminLogin
  };
}
