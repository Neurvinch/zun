import React, { useState, useEffect } from 'react';
import { useAccount, useProvider, useSigner } from 'wagmi';
import { toast } from 'react-hot-toast';
import customIdentityService, { VerificationMethod, VerificationStatus } from '../services/customIdentityService';

const CustomIdentityVerification = () => {
    const { address, isConnected } = useAccount();
    const provider = useProvider();
    const { data: signer } = useSigner();

    const [isInitialized, setIsInitialized] = useState(false);
    const [userDetails, setUserDetails] = useState(null);
    const [verificationMethods, setVerificationMethods] = useState({});
    const [socialVouchers, setSocialVouchers] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form states
    const [selectedMethods, setSelectedMethods] = useState([]);
    const [formData, setFormData] = useState({
        nationality: '',
        age: '',
        stakeAmount: '0.1',
        socialVoucherAddress: '',
        socialVouchers: [],
        biometricProof: '',
        disputeAddress: '',
        disputeReason: '',
        withdrawAmount: '0'
    });

    // Initialize service
    useEffect(() => {
        const initService = async () => {
            if (isConnected && provider && signer && !isInitialized) {
                try {
                    await customIdentityService.initialize(provider, signer);
                    setIsInitialized(true);
                } catch (error) {
                    console.error('Failed to initialize custom identity service:', error);
                    toast.error('Failed to initialize identity verification service');
                }
            }
        };

        initService();
    }, [isConnected, provider, signer, isInitialized]);

    // Load user data
    useEffect(() => {
        const loadUserData = async () => {
            if (isInitialized && address) {
                try {
                    setLoading(true);
                    
                    const [details, methods, vouchers] = await Promise.all([
                        customIdentityService.getUserVerificationDetails(address),
                        customIdentityService.getUserVerificationMethods(address),
                        customIdentityService.getUserSocialVouchers(address)
                    ]);

                    setUserDetails(details);
                    setVerificationMethods(methods);
                    setSocialVouchers(vouchers);
                } catch (error) {
                    console.error('Error loading user data:', error);
                } finally {
                    setLoading(false);
                }
            }
        };

        loadUserData();
    }, [isInitialized, address]);

    const handleMethodToggle = (method) => {
        setSelectedMethods(prev => 
            prev.includes(method) 
                ? prev.filter(m => m !== method)
                : [...prev, method]
        );
    };

    const handleAddSocialVoucher = () => {
        if (formData.socialVoucherAddress && !formData.socialVouchers.includes(formData.socialVoucherAddress)) {
            setFormData(prev => ({
                ...prev,
                socialVouchers: [...prev.socialVouchers, prev.socialVoucherAddress],
                socialVoucherAddress: ''
            }));
        }
    };

    const handleRemoveSocialVoucher = (address) => {
        setFormData(prev => ({
            ...prev,
            socialVouchers: prev.socialVouchers.filter(addr => addr !== address)
        }));
    };

    const handleRequestVerification = async () => {
        if (selectedMethods.length === 0) {
            toast.error('Please select at least one verification method');
            return;
        }

        try {
            setLoading(true);

            const verificationData = {
                additionalData: {
                    nationality: formData.nationality,
                    age: parseInt(formData.age) || 0,
                    metadata: 'ZKVault Custom Verification'
                }
            };

            // Add method-specific data
            if (selectedMethods.includes(VerificationMethod.SOCIAL_VERIFICATION)) {
                verificationData.socialVouchers = formData.socialVouchers;
            }

            if (selectedMethods.includes(VerificationMethod.STAKE_VERIFICATION)) {
                verificationData.stakeAmount = formData.stakeAmount;
            }

            if (selectedMethods.includes(VerificationMethod.ACTIVITY_VERIFICATION)) {
                verificationData.activityMetrics = await customIdentityService.generateActivityMetrics(address);
            }

            if (selectedMethods.includes(VerificationMethod.BIOMETRIC_ZK_PROOF)) {
                verificationData.biometricProof = formData.biometricProof || '0x1234567890abcdef';
            }

            const result = await customIdentityService.requestComprehensiveVerification(verificationData);
            
            if (result.success) {
                toast.success('Verification request submitted successfully!');
                // Reload user data
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
        } catch (error) {
            console.error('Error requesting verification:', error);
            toast.error('Failed to request verification');
        } finally {
            setLoading(false);
        }
    };

    const handleDisputeVerification = async () => {
        if (!formData.disputeAddress || !formData.disputeReason) {
            toast.error('Please provide dispute address and reason');
            return;
        }

        try {
            setLoading(true);
            await customIdentityService.disputeVerification(formData.disputeAddress, formData.disputeReason);
            setFormData(prev => ({ ...prev, disputeAddress: '', disputeReason: '' }));
        } catch (error) {
            console.error('Error disputing verification:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleWithdrawStake = async () => {
        if (!formData.withdrawAmount || parseFloat(formData.withdrawAmount) <= 0) {
            toast.error('Please provide a valid withdrawal amount');
            return;
        }

        try {
            setLoading(true);
            await customIdentityService.withdrawStake(formData.withdrawAmount);
            setFormData(prev => ({ ...prev, withdrawAmount: '0' }));
        } catch (error) {
            console.error('Error withdrawing stake:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case VerificationStatus.VERIFIED: return 'text-green-600 bg-green-100';
            case VerificationStatus.PENDING: return 'text-yellow-600 bg-yellow-100';
            case VerificationStatus.DISPUTED: return 'text-red-600 bg-red-100';
            case VerificationStatus.REVOKED: return 'text-gray-600 bg-gray-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const estimatedScore = customIdentityService.calculateEstimatedScore(selectedMethods);

    if (!isConnected) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Custom Identity Verification</h2>
                <p className="text-gray-600">Please connect your wallet to access identity verification.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Custom Identity Verification</h2>
                {userDetails && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(userDetails.status)}`}>
                        {customIdentityService.getStatusText(userDetails.status)}
                    </span>
                )}
            </div>

            {loading && (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">Loading...</span>
                </div>
            )}

            {/* User Status Overview */}
            {userDetails && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Verification Status</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-gray-600">Verification Score</p>
                            <p className="text-xl font-bold text-blue-600">{userDetails.verificationScore}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Reputation Score</p>
                            <p className="text-xl font-bold text-green-600">{userDetails.reputationScore}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Stake Amount</p>
                            <p className="text-xl font-bold text-purple-600">{userDetails.stakeAmount} ETH</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Expires</p>
                            <p className="text-sm text-gray-800">
                                {userDetails.expirationTimestamp > 0 
                                    ? new Date(userDetails.expirationTimestamp * 1000).toLocaleDateString()
                                    : 'N/A'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Verification Methods */}
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Available Verification Methods</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(VerificationMethod).map(([methodName, methodId]) => (
                        <div key={methodId} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedMethods.includes(methodId)}
                                        onChange={() => handleMethodToggle(methodId)}
                                        className="mr-2"
                                        disabled={verificationMethods[methodName]}
                                    />
                                    <span className="font-medium">
                                        {customIdentityService.getMethodName(methodId)}
                                    </span>
                                </label>
                                {verificationMethods[methodName] && (
                                    <span className="text-green-600 text-sm">✓ Completed</span>
                                )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                                Weight: {customIdentityService.getMethodWeights()[methodId]} points
                            </p>
                        </div>
                    ))}
                </div>
                
                {selectedMethods.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800">
                            Estimated Score: <strong>{estimatedScore} points</strong>
                            {estimatedScore >= 100 && <span className="text-green-600 ml-2">✓ Meets minimum requirement</span>}
                        </p>
                    </div>
                )}
            </div>

            {/* Verification Form */}
            <div className="space-y-6">
                {/* Basic Information */}
                <div>
                    <h4 className="text-md font-semibold text-gray-800 mb-3">Basic Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nationality (Optional)
                            </label>
                            <input
                                type="text"
                                value={formData.nationality}
                                onChange={(e) => setFormData(prev => ({ ...prev, nationality: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., US, UK, CA"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Age (Optional)
                            </label>
                            <input
                                type="number"
                                value={formData.age}
                                onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="18"
                                min="18"
                            />
                        </div>
                    </div>
                </div>

                {/* Social Verification */}
                {selectedMethods.includes(VerificationMethod.SOCIAL_VERIFICATION) && (
                    <div>
                        <h4 className="text-md font-semibold text-gray-800 mb-3">Social Verification</h4>
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={formData.socialVoucherAddress}
                                    onChange={(e) => setFormData(prev => ({ ...prev, socialVoucherAddress: e.target.value }))}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Voucher wallet address"
                                />
                                <button
                                    onClick={handleAddSocialVoucher}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Add
                                </button>
                            </div>
                            {formData.socialVouchers.length > 0 && (
                                <div>
                                    <p className="text-sm text-gray-600 mb-2">Vouchers ({formData.socialVouchers.length}/3 required):</p>
                                    <div className="space-y-1">
                                        {formData.socialVouchers.map((address, index) => (
                                            <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                                                <span className="text-sm font-mono">{address}</span>
                                                <button
                                                    onClick={() => handleRemoveSocialVoucher(address)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Stake Verification */}
                {selectedMethods.includes(VerificationMethod.STAKE_VERIFICATION) && (
                    <div>
                        <h4 className="text-md font-semibold text-gray-800 mb-3">Stake Verification</h4>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Stake Amount (ETH)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.1"
                                value={formData.stakeAmount}
                                onChange={(e) => setFormData(prev => ({ ...prev, stakeAmount: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Minimum: 0.1 ETH</p>
                        </div>
                    </div>
                )}

                {/* Biometric Verification */}
                {selectedMethods.includes(VerificationMethod.BIOMETRIC_ZK_PROOF) && (
                    <div>
                        <h4 className="text-md font-semibold text-gray-800 mb-3">Biometric ZK Proof</h4>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ZK Proof Data (Hex)
                            </label>
                            <input
                                type="text"
                                value={formData.biometricProof}
                                onChange={(e) => setFormData(prev => ({ ...prev, biometricProof: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0x1234567890abcdef..."
                            />
                            <p className="text-xs text-gray-500 mt-1">In production, this would be generated by biometric scanning</p>
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    onClick={handleRequestVerification}
                    disabled={loading || selectedMethods.length === 0}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                >
                    {loading ? 'Processing...' : 'Request Verification'}
                </button>
            </div>

            {/* Additional Actions */}
            {userDetails && userDetails.status === VerificationStatus.VERIFIED && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Additional Actions</h3>
                    
                    {/* Dispute Verification */}
                    <div className="mb-6">
                        <h4 className="text-md font-semibold text-gray-800 mb-3">Dispute Verification</h4>
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={formData.disputeAddress}
                                onChange={(e) => setFormData(prev => ({ ...prev, disputeAddress: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Address to dispute"
                            />
                            <textarea
                                value={formData.disputeReason}
                                onChange={(e) => setFormData(prev => ({ ...prev, disputeReason: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Reason for dispute"
                                rows="3"
                            />
                            <button
                                onClick={handleDisputeVerification}
                                disabled={loading}
                                className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:bg-gray-400"
                            >
                                Submit Dispute
                            </button>
                        </div>
                    </div>

                    {/* Withdraw Stake */}
                    {userDetails.stakeAmount > 0 && (
                        <div>
                            <h4 className="text-md font-semibold text-gray-800 mb-3">Withdraw Stake</h4>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.withdrawAmount}
                                    onChange={(e) => setFormData(prev => ({ ...prev, withdrawAmount: e.target.value }))}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Amount to withdraw"
                                    max={userDetails.stakeAmount}
                                />
                                <button
                                    onClick={handleWithdrawStake}
                                    disabled={loading}
                                    className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400"
                                >
                                    Withdraw
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Available: {userDetails.stakeAmount} ETH
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Social Vouchers Display */}
            {socialVouchers.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Your Social Vouchers</h3>
                    <div className="space-y-2">
                        {socialVouchers.map((voucher, index) => (
                            <div key={index} className="bg-gray-50 px-3 py-2 rounded font-mono text-sm">
                                {voucher}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomIdentityVerification;
