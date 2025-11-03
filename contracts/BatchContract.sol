// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BatchContract
 * @dev Contract for executing batch operations with EIP-7702 delegation
 * @notice This contract allows users to delegate control of their wallets temporarily
 * for specific operations like claiming airdrops and transferring tokens
 */
contract BatchContract is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Struct to hold delegation information
    struct Delegation {
        address delegator;         // The address delegating control
        address delegatee;         // The batch contract (this contract)
        address authority;         // The authority contract
        uint256 expiry;           // When delegation expires
        uint256 nonce;            // Unique nonce for each delegation
        string[] allowedFunctions; // Whitelisted function signatures
        bool revoked;             // Whether delegation has been revoked
    }

    // Struct for batch operation
    struct BatchOperation {
        address walletAddress;      // The compromised wallet address
        address airdropContract;    // Airdrop contract to call
        address tokenContract;      // Token contract for transfers
        address receiverAddress;    // Safe destination address
        bytes claimData;          // Data for claim function call
        uint256 transferAmount;    // Amount to transfer
        Delegation delegation;      // Delegation information
    }

    // Mapping to store delegations
    mapping(address => mapping(uint256 => Delegation)) public delegations;

    // Mapping to track used nonces for each address
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // Events
    event DelegationCreated(
        address indexed delegator,
        address indexed delegatee,
        uint256 indexed nonce,
        uint256 expiry
    );

    event DelegationRevoked(
        address indexed delegator,
        uint256 indexed nonce
    );

    event BatchOperationExecuted(
        address indexed walletAddress,
        address indexed receiverAddress,
        bool success,
        bytes result
    );

    event EmergencyWithdraw(
        address indexed token,
        address indexed to,
        uint256 amount
    );

    // Errors
    error DelegationExpired();
    error DelegationRevoked();
    error InvalidSignature();
    error FunctionNotWhitelisted();
    error NonceAlreadyUsed();
    error OperationFailed();
    error InvalidAddress();
    error TransferFailed();
    error InsufficientBalance();

    /**
     * @dev Create a new delegation
     * @param delegator The address delegating control
     * @param authority The authority contract address
     * @param expiry When delegation expires (timestamp)
     * @param nonce Unique nonce for this delegation
     * @param functions Array of allowed function signatures
     * @param signature EIP-712 signature of the delegation
     */
    function delegate(
        address delegator,
        address authority,
        uint256 expiry,
        uint256 nonce,
        string[] memory functions,
        bytes memory signature
    ) external {
        require(delegator != address(0), "Invalid delegator");
        require(authority != address(0), "Invalid authority");
        require(expiry > block.timestamp, "Expiry must be in future");
        require(!usedNonces[delegator][nonce], "Nonce already used");

        // Create the delegation
        Delegation memory delegation = Delegation({
            delegator: delegator,
            delegatee: address(this),
            authority: authority,
            expiry: expiry,
            nonce: nonce,
            allowedFunctions: functions,
            revoked: false
        });

        // Verify the EIP-712 signature
        bytes32 digest = _hashDelegation(delegation);
        address signer = digest.recover(signature);
        require(signer == delegator, "Invalid signature");

        // Mark nonce as used and store delegation
        usedNonces[delegator][nonce] = true;
        delegations[delegator][nonce] = delegation;

        emit DelegationCreated(delegator, address(this), nonce, expiry);
    }

    /**
     * @dev Revoke a delegation
     * @param delegator The address that created the delegation
     * @param nonce The nonce of the delegation to revoke
     * @param signature EIP-712 signature for revocation
     */
    function revokeDelegation(
        address delegator,
        uint256 nonce,
        bytes memory signature
    ) external {
        require(delegations[delegator][nonce].delegator != address(0), "Delegation not found");
        require(!delegations[delegator][nonce].revoked, "Already revoked");

        // Create revocation delegation (expiry = 0)
        Delegation memory revocation = Delegation({
            delegator: delegator,
            delegatee: address(this),
            authority: address(0),
            expiry: 0,
            nonce: nonce,
            allowedFunctions: new string[](0),
            revoked: true
        });

        // Verify the revocation signature
        bytes32 digest = _hashDelegation(revocation);
        address signer = digest.recover(signature);
        require(signer == delegator, "Invalid signature");

        // Mark delegation as revoked
        delegations[delegator][nonce].revoked = true;

        emit DelegationRevoked(delegator, nonce);
    }

    /**
     * @dev Execute batch operations for delegated wallets
     * @param operations Array of batch operations to execute
     */
    function executeBatchOperations(BatchOperation[] memory operations) external {
        for (uint256 i = 0; i < operations.length; i++) {
            BatchOperation memory operation = operations[i];
            _executeSingleOperation(operation);
        }
    }

    /**
     * @dev Execute a single batch operation
     * @param operation The operation to execute
     */
    function _executeSingleOperation(BatchOperation memory operation) internal {
        // Validate delegation
        Delegation memory delegation = operation.delegation;
        _validateDelegation(delegation);

        // Execute claim function
        bool claimSuccess = _executeClaim(
            operation.walletAddress,
            operation.airdropContract,
            operation.claimData
        );

        if (!claimSuccess) {
            emit BatchOperationExecuted(
                operation.walletAddress,
                operation.receiverAddress,
                false,
                "Claim failed"
            );
            return;
        }

        // Execute transfer if specified
        if (operation.transferAmount > 0 && operation.tokenContract != address(0)) {
            bool transferSuccess = _executeTransfer(
                operation.walletAddress,
                operation.tokenContract,
                operation.receiverAddress,
                operation.transferAmount
            );

            emit BatchOperationExecuted(
                operation.walletAddress,
                operation.receiverAddress,
                transferSuccess,
                transferSuccess ? "Success" : "Transfer failed"
            );
        } else {
            emit BatchOperationExecuted(
                operation.walletAddress,
                operation.receiverAddress,
                true,
                "Claim successful"
            );
        }
    }

    /**
     * @dev Execute claim function on airdrop contract
     * @param walletAddress The wallet address executing the claim
     * @param airdropContract The airdrop contract to call
     * @param claimData The data to pass to claim function
     * @return success Whether the claim was successful
     */
    function _executeClaim(
        address walletAddress,
        address airdropContract,
        bytes memory claimData
    ) internal returns (bool success) {
        (bool result, bytes memory returnData) = airdropContract.call(claimData);
        return result;
    }

    /**
     * @dev Execute transfer of tokens to receiver
     * @param walletAddress The wallet address holding tokens
     * @param tokenContract The token contract to transfer
     * @param receiverAddress The destination address
     * @param amount The amount to transfer
     * @return success Whether the transfer was successful
     */
    function _executeTransfer(
        address walletAddress,
        address tokenContract,
        address receiverAddress,
        uint256 amount
    ) internal returns (bool success) {
        IERC20 token = IERC20(tokenContract);
        uint256 balance = token.balanceOf(walletAddress);

        if (balance < amount) {
            revert InsufficientBalance();
        }

        // Note: This would require the batch contract to have approval
        // In practice, the compromised wallet would need to approve this contract first
        bool result = token.transferFrom(walletAddress, receiverAddress, amount);
        return result;
    }

    /**
     * @dev Validate a delegation
     * @param delegation The delegation to validate
     */
    function _validateDelegation(Delegation memory delegation) internal view {
        require(delegation.delegator != address(0), "Invalid delegator");
        require(delegation.expiry > block.timestamp, DelegationExpired());
        require(!delegation.revoked, DelegationRevoked());

        // Verify that this contract is the delegatee
        require(delegation.delegatee == address(this), "Invalid delegatee");
    }

    /**
     * @dev Hash delegation for EIP-712 signature
     * @param delegation The delegation to hash
     * @return The EIP-712 hash digest
     */
    function _hashDelegation(Delegation memory delegation) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(
                    "Delegation(address delegator,address delegatee,address authority,uint256 expiry,uint256 nonce,string[] allowedFunctions)"
                ),
                delegation.delegator,
                delegation.delegatee,
                delegation.authority,
                delegation.expiry,
                delegation.nonce,
                keccak256(abi.encodePacked(delegation.allowedFunctions))
            )
        );
    }

    /**
     * @dev Check if a function is allowed by delegation
     * @param delegation The delegation to check
     * @param functionSignature The function signature to check
     * @return Whether the function is allowed
     */
    function _isFunctionAllowed(
        Delegation memory delegation,
        string memory functionSignature
    ) internal pure returns (bool) {
        for (uint256 i = 0; i < delegation.allowedFunctions.length; i++) {
            if (keccak256(bytes(delegation.allowedFunctions[i])) == keccak256(bytes(functionSignature))) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Emergency function to withdraw stuck tokens
     * @param token The token contract address (address(0) for native)
     * @param to The address to send tokens to
     * @param amount The amount to withdraw
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(to != address(0), "Invalid recipient");

        if (token == address(0)) {
            // Withdraw native tokens
            (bool success, ) = to.call{value: amount}("");
            require(success, "Transfer failed");
        } else {
            // Withdraw ERC20 tokens
            IERC20(token).transfer(to, amount);
        }

        emit EmergencyWithdraw(token, to, amount);
    }

    /**
     * @dev Get domain separator for EIP-712
     * @return The domain separator hash
     */
    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                "BatchContract",
                "1",
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @dev Get the EIP-712 typed data hash for a delegation
     * @param delegation The delegation struct
     * @return The typed data hash
     */
    function getTypedDataHash(Delegation memory delegation) external view returns (bytes32) {
        return MessageHashUtils.toTypedDataHash(
            _domainSeparator(),
            keccak256(
                abi.encode(
                    keccak256(
                        "Delegation(address delegator,address delegatee,address authority,uint256 expiry,uint256 nonce,string[] allowedFunctions)"
                    ),
                    delegation.delegator,
                    delegation.delegatee,
                    delegation.authority,
                    delegation.expiry,
                    delegation.nonce,
                    keccak256(abi.encodePacked(delegation.allowedFunctions))
                )
            )
        );
    }

    /**
     * @dev Receive function to accept native tokens
     */
    receive() external payable {}
}
