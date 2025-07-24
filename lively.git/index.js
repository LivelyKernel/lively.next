/* global fetch */
import { currentUserToken } from 'lively.user';
import { default as libsod } from 'libsodium-wrappers';

// TODO: This could all use some sensible error handling -lh 15.02.2024

export class GitHubAPIWrapper {
  static async remoteRepoInfos (repoOwner, repoName) {
    const token = currentUserToken();
    const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}`, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    return await res.json();
  }

  static async addDeployKey (repoOwner, repoName, title, key) {
    const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/keys`, {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${currentUserToken()}`,
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        title,
        key,
        read_only: 'true'
      })
    });
  }

  static async listActionSecrets (repoOwner, repoName) {
    const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/actions/secrets`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${currentUserToken()}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    const secretData = await res.json();
    return secretData.secrets.map(s => s.name);
  }

  static async retrieveRepositoriesPublicKey (repoOwner, repoName) {
    const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/actions/secrets/public-key`, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${currentUserToken()}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    const keyData = await res.json();
    return {
      key: keyData.key,
      id: keyData.key_id
    };
  }

  static async addOrUpdateRepositorySecret (repoOwner, repoName, secretName, secret, publicKey, publicKeyId) {
    await libsod.ready;
    // Convert the secret and key to a Uint8Array.
    let binkey = libsod.from_base64(publicKey, libsod.base64_variants.ORIGINAL);
    let binsec = libsod.from_string(secret);

    // Encrypt the secret using libsodium
    let encBytes = libsod.crypto_box_seal(binsec, binkey);

    // Convert the encrypted Uint8Array to Base64
    const encryptedSecret = libsod.to_base64(encBytes, libsod.base64_variants.ORIGINAL);
    const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/actions/secrets/${secretName}`, {
      method: 'PUT',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${currentUserToken()}`,
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        encrypted_value: `${encryptedSecret}`,
        key_id: publicKeyId
      })
    });
  }

  static async deleteRepositorySecret (repoOwner, repoName, secretName) {
    const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/actions/secrets/${secretName}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${currentUserToken()}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
  }

  static async deleteDeployKey (repoOwner, repoName, title) {
  // TODO: If this is called with a non-existing key bad things happen!
    const resKeyList = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/keys`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${currentUserToken()}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    const deployKeys = await resKeyList.json();
    const keyIdToRemove = deployKeys.find(key => key.title === title).id;

    const resKeyDeletion = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/keys/${keyIdToRemove}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${currentUserToken()}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    }

  static async listGithubBranches (repoOwner, repoName) {
    const token = currentUserToken();
    const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/branches`, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    const branchData = await res.json();
    // TODO: If this is called with a non-existing repository bad things happen!
    return branchData.map(b => b.name);
  }
}
