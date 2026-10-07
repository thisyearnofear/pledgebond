import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useUser } from '@/stores/authStore';
import { useWallet } from '@/stores/walletStore';
import { sdk } from '@farcaster/miniapp-sdk';
import { db, storage } from '@/lib/firebase/clientApp';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import ethosService from '@/services/EthosService';
import { EthosScoreBadge, EthosProfileLink } from '@/components/ethos';
import SnsIdentityBadge from '@/components/common/SnsIdentityBadge';
import { BuilderTrustFull } from '@/components/common/BuilderTrust';
import { PencilSquareIcon, LinkIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from '@/components/common/LoadingStates';

function EmailToggle({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer group">
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">{label}</p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}

export default function UserProfile() {
  const { currentUser, logout, linkedWallets, unlinkWallet, userRole } = useUser();
  const { disconnect: disconnectEvm, disconnectSolana } = useWallet();

  const [githubUsername, setGithubUsername] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [discord, setDiscord] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [linksExpanded, setLinksExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [ethosUser, setEthosUser] = useState(null);
  const [ethosLoading, setEthosLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [emailDigest, setEmailDigest] = useState(false);
  const [emailProjectUpdates, setEmailProjectUpdates] = useState(true);
  const [emailBackerActivity, setEmailBackerActivity] = useState(true);
  const [emailMarketing, setEmailMarketing] = useState(false);
  const [emailPrefsExpanded, setEmailPrefsExpanded] = useState(false);
  const [isFrame, setIsFrame] = useState(false);
  const [unlinking, setUnlinking] = useState(null);
  const [weftLinking, setWeftLinking] = useState(false);
  const [linkedWeftIdentity, setLinkedWeftIdentity] = useState(null);
  const [verifiedWinner, setVerifiedWinner] = useState(false);
  const [winnerData, setWinnerData] = useState(null);
  const fileInputRef = useRef(null);

  // Primary Solana wallet for trust display
  const primarySolanaWallet = linkedWallets.find(w => w.chainFamily === 'solana')?.address;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsFrame(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!currentUser?.uid) { setLoading(false); return; }
      try {
        setError(null);
        const userRef = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(userRef);
        if (!cancelled && snap.exists) {
          const data = snap.data();
          setGithubUsername(String(data.githubUsername || ''));
          setDisplayNameInput(String(data.displayName || ''));
          setBio(String(data.bio || ''));
          setWebsite(String(data.website || ''));
          setTwitter(String(data.twitter || ''));
          setDiscord(String(data.discord || ''));
          setPhotoURL(String(data.photoURL || ''));
          setNotificationsEnabled(!!data.notificationsEnabled);
          setEmailDigest(!!data.emailDigest);
          setEmailProjectUpdates(data.emailProjectUpdates !== false); // default true
          setEmailBackerActivity(data.emailBackerActivity !== false); // default true
          setEmailMarketing(!!data.emailMarketing);
          setLinkedWeftIdentity(data.linkedWeftIdentity || null);
          setVerifiedWinner(!!data.verifiedWinner);
          setWinnerData(data.winnerData || null);
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [currentUser?.uid]);

  const handleLinkWeftIdentity = async () => {
    if (!linkedWallets.length) {
      setError('Connect a wallet to link a Weft identity');
      return;
    }

    try {
      setWeftLinking(true);
      setError(null);

      // Use the primary wallet to sign the handshake message
      const wallet = linkedWallets[0];
      const message = `Link Weft Identity for PledgeBond: ${currentUser.uid}`;

      let signature;
      if (wallet.chainFamily === 'solana') {
         // Logic for solana signing using window.solana
         signature = await window.solana.request({
            method: 'signMessage',
            params: { message: new TextEncoder().encode(message), display: 'utf8' }
         });
      } else {
         // Default to metamask/evm
         signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [message, wallet.address]
         });
      }

      const userRef = doc(db, 'users', currentUser.uid);
      const identityData = {
        address: wallet.address,
        chain: wallet.chainFamily,
        signature: signature.signature || signature,
        timestamp: Date.now()
      };

      await setDoc(userRef, { linkedWeftIdentity: identityData }, { merge: true });
      setLinkedWeftIdentity(identityData);
      setSuccess('Weft identity linked successfully');
    } catch (e) {
      console.error(e);
      setError('Failed to link Weft identity: ' + e.message);
    } finally {
      setWeftLinking(false);
    }
  };


  // Fetch Ethos score when linked wallets change
  useEffect(() => {
    if (linkedWallets.length === 0) { setEthosUser(null); return; }
    let cancelled = false;
    const primary = linkedWallets[0];
    setEthosLoading(true);
    ethosService.getScoresByAddress(primary.address)
      .then(data => { if (!cancelled) setEthosUser(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEthosLoading(false); });
    return () => { cancelled = true; };
  }, [linkedWallets]);

  const handleLogout = async () => {
    try {
      disconnectEvm();
      disconnectSolana();
      await logout();
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const handleUnlink = async (address) => {
    try {
      setUnlinking(address);
      setError(null);
      await unlinkWallet(address);
      setSuccess('Wallet unlinked');
    } catch (e) {
      setError('Failed to unlink wallet');
    } finally {
      setUnlinking(null);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2MB");
      return;
    }

    setUploadingAvatar(true);
    try {
      // Resize to avatar-friendly dimensions
      const img = new window.Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });

      const canvas = document.createElement("canvas");
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      // Center-crop square
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));

      const timestamp = Date.now();
      const storagePath = `profile_avatars/${currentUser.uid}/${timestamp}.jpg`;
      const storageRef = ref(storage, storagePath);

      const snapshot = await uploadBytes(storageRef, blob, {
        contentType: "image/jpeg",
      });

      const downloadUrl = await getDownloadURL(snapshot.ref);
      setPhotoURL(downloadUrl);
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setError(`Upload failed: ${err.message || "Please try again."}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onSave = async (e) => {
    e.preventDefault();
    if (!currentUser?.uid) return;
    try {
      setSaving(true); setError(null); setSuccess(null);

      const gh = (githubUsername || '').trim();
      if (gh && !/^([A-Za-z0-9-]{1,39})$/.test(gh)) {
        setError('Invalid GitHub username format');
        setSaving(false);
        return;
      }

      // Validate URLs if provided
      const websiteVal = (website || '').trim();
      const twitterVal = (twitter || '').trim();
      const discordVal = (discord || '').trim();

      if (websiteVal && !/^https?:\/\//.test(websiteVal)) {
        setError('Website URL must start with http:// or https://');
        setSaving(false);
        return;
      }
      if (twitterVal && !/^https?:\/\//.test(twitterVal)) {
        setError('Twitter URL must start with http:// or https://');
        setSaving(false);
        return;
      }
      if (discordVal && !/^https?:\/\//.test(discordVal)) {
        setError('Discord URL must start with http:// or https://');
        setSaving(false);
        return;
      }

      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        githubUsername: gh || null,
        displayName: (displayNameInput || '').trim() || null,
        bio: (bio || '').trim() || null,
        website: websiteVal || null,
        twitter: twitterVal || null,
        discord: discordVal || null,
        photoURL: photoURL || null,
        notificationsEnabled,
        emailDigest: !!emailDigest,
        emailProjectUpdates: !!emailProjectUpdates,
        emailBackerActivity: !!emailBackerActivity,
        emailMarketing: !!emailMarketing,
      }, { merge: true });

      setSuccess('Profile updated');
    } catch (e) {
      console.error(e);
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNotifications = async () => {
    try {
      if (!notificationsEnabled) {
        const context = sdk.context;
        await sdk.actions.addMiniApp();
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, {
          notificationsEnabled: true,
          farcasterFid: context?.user?.fid || null,
        }, { merge: true });
        setNotificationsEnabled(true);
        setSuccess('Farcaster notifications enabled');
      } else {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, { notificationsEnabled: false }, { merge: true });
        setNotificationsEnabled(false);
        setSuccess('Notifications disabled');
      }
    } catch (e) {
      console.error('Notification toggle failed:', e);
      setError('Failed to update notification settings');
    }
  };

  const formatAddress = (addr, chainFamily) => {
    if (chainFamily === 'solana') return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!currentUser) return null;

  const isBacker = userRole === 'backer';
  const primaryWallet = linkedWallets[0]?.address;
  const resolvedDisplayName = displayNameInput || currentUser.displayName || (primaryWallet ? formatAddress(primaryWallet, linkedWallets[0]?.chainFamily) : 'User');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
      {/* ── Avatar ── */}
      <div className="flex items-start space-x-4 mb-6">
        <div className="relative group flex-shrink-0">
          {photoURL || currentUser?.photoURL ? (
            <img
              src={photoURL || currentUser.photoURL}
              alt={resolvedDisplayName}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-100"
            />
          ) : primaryWallet ? (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold ring-2 ring-gray-100">
              {resolvedDisplayName.slice(0, 2).toUpperCase()}
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xl font-bold ring-2 ring-gray-100">
              U
            </div>
          )}

          {/* Edit avatar overlay */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute inset-0 rounded-full bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100"
            title="Change photo"
          >
            {uploadingAvatar ? (
              <LoadingSpinner size="sm" className="text-white" />
            ) : (
              <PencilSquareIcon className="w-5 h-5 text-white" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">{resolvedDisplayName}</h2>
            {verifiedWinner && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800 flex-shrink-0" title={winnerData?.totalWins ? `Verified winner of ${winnerData.totalWins} hackathon${winnerData.totalWins !== 1 ? 's' : ''}` : 'Verified hackathon winner'}>
                <TrophyIcon className="w-3 h-3" />
                Verified Winner
              </span>
            )}
            {userRole && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded flex-shrink-0 ${isBacker ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'}`}>
                {isBacker ? 'Lender' : 'Builder'}
              </span>
            )}
          </div>
          {!isBacker && currentUser.email && <p className="text-gray-600 dark:text-gray-400 text-sm truncate">{currentUser.email}</p>}
          {githubUsername && (
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              Portfolio: <a href={`/u/${githubUsername}`} className="text-blue-600 dark:text-blue-400 underline">/u/{githubUsername}</a>
            </p>
          )}

          {ethosLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading Ethos score...</div>
          ) : ethosUser ? (
            <div className="flex items-center gap-2 mt-2">
              <EthosScoreBadge score={ethosUser.score} ethosUser={ethosUser} size="sm" />
              <EthosProfileLink address={linkedWallets[0]?.address} username={ethosUser.username} className="text-xs">
                View Details
              </EthosProfileLink>
            </div>
          ) : linkedWallets.length > 0 ? (
            <div className="mt-2">
              <EthosScoreBadge score={null} size="sm" />
            </div>
          ) : null}

          {/* FairScore — Solana on-chain reputation */}
          {primarySolanaWallet && (
            <div className="mt-3">
              <BuilderTrustFull address={primarySolanaWallet} />
            </div>
          )}
        </div>
      </div>

      <form onSubmit={onSave} className="space-y-4 mb-6">
        {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
        {success && <div className="text-sm text-green-700 dark:text-green-400">{success}</div>}

        {/* Display name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Display name</label>
          <input
            className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Your public name"
            value={displayNameInput}
            onChange={(e) => setDisplayNameInput(e.target.value)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Shown on your profile page and project cards.</p>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
          <textarea
            className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            placeholder="Tell lenders about yourself — what you build, your background, your mission."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{bio.length}/500 characters.</p>
        </div>

        {!isBacker && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">GitHub username</label>
            <input
              className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g. thisyearnofear"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Used for your portfolio subdomain and project ownership verification.</p>
          </div>
        )}

        {/* Links — collapsible */}
        <div>
          <button
            type="button"
            onClick={() => setLinksExpanded(!linksExpanded)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 transition-colors"
          >
            <LinkIcon className="w-4 h-4" />
            <span>Social links {(website || twitter || discord) ? `(${[website, twitter, discord].filter(Boolean).length} added)` : ''}</span>
            <svg
              className={`w-4 h-4 transition-transform ${linksExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {linksExpanded && (
            <div className="mt-3 space-y-3 pl-1">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Website</label>
                <input
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="https://yourapp.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Twitter / X</label>
                <input
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="https://x.com/yourhandle"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Discord</label>
                <input
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="https://discord.gg/yourserver"
                  value={discord}
                  onChange={(e) => setDiscord(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Weft Verification Identity */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">Weft Identity Verification</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bridge your profile for autonomous auditing.</p>
            </div>
            {linkedWeftIdentity ? (
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs rounded-full font-medium">Linked ✓</span>
            ) : (
              <button
                type="button"
                onClick={handleLinkWeftIdentity}
                disabled={weftLinking}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded font-medium disabled:opacity-50"
              >
                {weftLinking ? 'Linking...' : 'Link Identity'}
              </button>
            )}
          </div>
          {linkedWeftIdentity && (
            <p className="text-xs text-gray-400 font-mono break-all bg-white dark:bg-gray-900 p-2 rounded">
              Linked: {linkedWeftIdentity.address} ({linkedWeftIdentity.chain})
            </p>
          )}
        </div>

        {/* Verified Wallets */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Verified Wallets</label>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">These were verified during sign-in. Used for payouts and identity.</p>
          {linkedWallets.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 py-3">
              No wallets verified yet.{' '}
              <Link href="/login" className="text-blue-600 dark:text-blue-400 underline">Connect a wallet</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedWallets.map((w) => (
                <div key={w.address} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${w.chainFamily === 'solana' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'}`}>
                      {w.chainFamily === 'solana' ? 'Phantom' : 'MetaMask'}
                    </span>
                    <SnsIdentityBadge
                      address={w.address}
                      chainFamily={w.chainFamily}
                      showFallback={true}
                      showLoading={true}
                      className="text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnlink(w.address)}
                    disabled={unlinking === w.address}
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50"
                  >
                    {unlinking === w.address ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {linkedWallets.length > 0 && (
            <Link href="/login" className="inline-block mt-2 text-sm text-blue-600 dark:text-blue-400 underline">Add another wallet</Link>
          )}
        </div>

        {isFrame && (
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">Farcaster Notifications</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Get notified when your ships are verified</p>
            </div>
            <button
              type="button"
              onClick={handleToggleNotifications}
              className={`px-3 py-1 rounded text-xs font-medium ${
                notificationsEnabled
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-blue-600 text-white'
              }`}
            >
              {notificationsEnabled ? 'Enabled' : 'Enable'}
            </button>
          </div>
        )}

        {/* Email notification preferences */}
        {currentUser.email && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setEmailPrefsExpanded(!emailPrefsExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email Notifications
                </span>
                <span className="text-xs text-gray-400">
                  {[emailDigest, emailProjectUpdates, emailBackerActivity, emailMarketing].filter(Boolean).length} active
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${emailPrefsExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {emailPrefsExpanded && (
              <div className="px-4 py-3 space-y-4 bg-white dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Updates sent to <span className="font-medium text-gray-700 dark:text-gray-300">{currentUser.email}</span>
                </p>

                <EmailToggle
                  label="Weekly digest"
                  description="Summary of your project activity, stars, and verification status every Monday."
                  checked={emailDigest}
                  onChange={setEmailDigest}
                />

                <EmailToggle
                  label="Project updates"
                  description="When your projects are verified, receive feedback, or status changes."
                  checked={emailProjectUpdates}
                  onChange={setEmailProjectUpdates}
                />

                <EmailToggle
                  label="Lender activity"
                  description="Notify when someone backs your project, follows you, or leaves feedback."
                  checked={emailBackerActivity}
                  onChange={setEmailBackerActivity}
                />

                <EmailToggle
                  label="Product announcements"
                  description="New features, ecosystem opportunities, and platform updates."
                  checked={emailMarketing}
                  onChange={setEmailMarketing}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={handleLogout} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded">Sign Out</button>
        </div>
      </form>

    </div>
  );
}
