const fs = require('fs');
const path = require('path');

/**
 * ZKVault Protocol - Hackathon Requirements Validation
 * 
 * This script validates that all hackathon requirements are met:
 * - Akave O3 S3-compatible API usage
 * - Lighthouse SDK integration with DataDAO
 * - Synapse SDK for Filecoin warm storage
 * - Live data integration with zkTLS validation
 * - Contract deployment to required networks
 */

class HackathonValidator {
    constructor() {
        this.results = {
            akave: { score: 0, maxScore: 4, checks: [] },
            lighthouse: { score: 0, maxScore: 5, checks: [] },
            synapse: { score: 0, maxScore: 4, checks: [] },
            overall: { score: 0, maxScore: 13, checks: [] }
        };
        
        this.projectRoot = path.join(__dirname, '..');
    }
    
    /**
     * Run all validation checks
     */
    async validate() {
        console.log('🔍 ZKVault Protocol - Hackathon Requirements Validation');
        console.log('=' .repeat(60));
        
        try {
            await this.validateAkaveIntegration();
            await this.validateLighthouseIntegration();
            await this.validateSynapseIntegration();
            await this.validateOverallRequirements();
            
            this.printResults();
            this.generateReport();
            
        } catch (error) {
            console.error('❌ Validation failed:', error.message);
            process.exit(1);
        }
    }
    
    /**
     * Validate Akave O3 Integration
     */
    async validateAkaveIntegration() {
        console.log('\n📦 Validating Akave O3 Integration...');
        
        // Check 1: Akave service implementation
        const akaveServicePath = path.join(this.projectRoot, 'frontend/src/services/akaveService.js');
        if (this.fileExists(akaveServicePath)) {
            this.addCheck('akave', '✅ Akave service implementation found');
            
            const content = fs.readFileSync(akaveServicePath, 'utf8');
            if (content.includes('S3Client') && content.includes('akave')) {
                this.addCheck('akave', '✅ S3-compatible API usage implemented');
            }
        } else {
            this.addCheck('akave', '❌ Akave service implementation missing');
        }
        
        // Check 2: Analytics dashboard component
        const analyticsDashPath = path.join(this.projectRoot, 'frontend/src/components/analytics/AnalyticsDashboard.jsx');
        if (this.fileExists(analyticsDashPath)) {
            this.addCheck('akave', '✅ Analytics dashboard component found');
        } else {
            this.addCheck('akave', '❌ Analytics dashboard component missing');
        }
        
        // Check 3: AI/ML dataset storage functionality
        const akaveServiceContent = this.getFileContent(akaveServicePath);
        if (akaveServiceContent && akaveServiceContent.includes('uploadMLDataset')) {
            this.addCheck('akave', '✅ AI/ML dataset storage functionality implemented');
        } else {
            this.addCheck('akave', '❌ AI/ML dataset storage functionality missing');
        }
        
        // Check 4: Environment configuration
        const envExamplePath = path.join(this.projectRoot, 'frontend/.env.example');
        const envContent = this.getFileContent(envExamplePath);
        if (envContent && envContent.includes('AKAVE_ACCESS_KEY_ID')) {
            this.addCheck('akave', '✅ Akave environment configuration present');
        } else {
            this.addCheck('akave', '❌ Akave environment configuration missing');
        }
    }
    
    /**
     * Validate Lighthouse Integration
     */
    async validateLighthouseIntegration() {
        console.log('\n🏠 Validating Lighthouse Integration...');
        
        // Check 1: Lighthouse service implementation
        const lighthouseServicePath = path.join(this.projectRoot, 'frontend/src/services/lighthouseService.js');
        if (this.fileExists(lighthouseServicePath)) {
            this.addCheck('lighthouse', '✅ Lighthouse service implementation found');
        } else {
            this.addCheck('lighthouse', '❌ Lighthouse service implementation missing');
        }
        
        // Check 2: DataDAO smart contract
        const dataDaoPath = path.join(this.projectRoot, 'contracts/DataDAO.sol');
        if (this.fileExists(dataDaoPath)) {
            this.addCheck('lighthouse', '✅ DataDAO smart contract found');
            
            const content = fs.readFileSync(dataDaoPath, 'utf8');
            if (content.includes('DataCoin') && content.includes('contributeData')) {
                this.addCheck('lighthouse', '✅ DataDAO functionality implemented');
            }
        } else {
            this.addCheck('lighthouse', '❌ DataDAO smart contract missing');
        }
        
        // Check 3: DataCoin token implementation
        const dataCoinPath = path.join(this.projectRoot, 'contracts/DataCoin.sol');
        if (this.fileExists(dataCoinPath)) {
            this.addCheck('lighthouse', '✅ DataCoin token contract found');
        } else {
            this.addCheck('lighthouse', '❌ DataCoin token contract missing');
        }
        
        // Check 4: Live data integration with zkTLS
        const liveDataServicePath = path.join(this.projectRoot, 'frontend/src/services/liveDataService.js');
        if (this.fileExists(liveDataServicePath)) {
            const content = fs.readFileSync(liveDataServicePath, 'utf8');
            if (content.includes('generateDataProof') && content.includes('verifyDataProof')) {
                this.addCheck('lighthouse', '✅ Live data integration with cryptographic proofs');
            } else {
                this.addCheck('lighthouse', '❌ Cryptographic proof validation missing');
            }
        } else {
            this.addCheck('lighthouse', '❌ Live data service missing');
        }
        
        // Check 5: DataDAO dashboard component
        const dataDAODashPath = path.join(this.projectRoot, 'frontend/src/components/datadao/DataDAODashboard.jsx');
        if (this.fileExists(dataDAODashPath)) {
            this.addCheck('lighthouse', '✅ DataDAO dashboard component found');
        } else {
            this.addCheck('lighthouse', '❌ DataDAO dashboard component missing');
        }
    }
    
    /**
     * Validate Synapse Integration
     */
    async validateSynapseIntegration() {
        console.log('\n🔗 Validating Synapse Integration...');
        
        // Check 1: Synapse service implementation
        const synapseServicePath = path.join(this.projectRoot, 'frontend/src/services/synapseService.js');
        if (this.fileExists(synapseServicePath)) {
            this.addCheck('synapse', '✅ Synapse service implementation found');
            
            const content = fs.readFileSync(synapseServicePath, 'utf8');
            if (content.includes('uploadToWarmStorage') && content.includes('payWithUSDFC')) {
                this.addCheck('synapse', '✅ Filecoin warm storage and USDFC payments implemented');
            }
        } else {
            this.addCheck('synapse', '❌ Synapse service implementation missing');
        }
        
        // Check 2: Synapse storage component
        const synapseComponentPath = path.join(this.projectRoot, 'frontend/src/components/SynapseStorage.jsx');
        if (this.fileExists(synapseComponentPath)) {
            this.addCheck('synapse', '✅ Synapse storage component found');
        } else {
            this.addCheck('synapse', '❌ Synapse storage component missing');
        }
        
        // Check 3: Package.json includes Synapse SDK
        const frontendPackagePath = path.join(this.projectRoot, 'frontend/package.json');
        const packageContent = this.getFileContent(frontendPackagePath);
        if (packageContent && packageContent.includes('@synapsecns/synapse-sdk')) {
            this.addCheck('synapse', '✅ Synapse SDK dependency found');
        } else {
            this.addCheck('synapse', '❌ Synapse SDK dependency missing');
        }
        
        // Check 4: Deployment to Filecoin Calibration testnet
        const deploymentConfigPath = path.join(this.projectRoot, 'hardhat.config.js');
        const deploymentContent = this.getFileContent(deploymentConfigPath);
        if (deploymentContent && deploymentContent.includes('filecoinCalibration')) {
            this.addCheck('synapse', '✅ Filecoin Calibration testnet configuration found');
        } else {
            this.addCheck('synapse', '❌ Filecoin Calibration testnet configuration missing');
        }
    }
    
    /**
     * Validate overall requirements
     */
    async validateOverallRequirements() {
        console.log('\n🎯 Validating Overall Requirements...');
        
        // Check deployment scripts
        const deployScriptPath = path.join(this.projectRoot, 'scripts/deploy.js');
        if (this.fileExists(deployScriptPath)) {
            this.addCheck('overall', '✅ Deployment scripts found');
        } else {
            this.addCheck('overall', '❌ Deployment scripts missing');
        }
        
        // Check comprehensive README
        const readmePath = path.join(this.projectRoot, 'README.md');
        if (this.fileExists(readmePath)) {
            const content = fs.readFileSync(readmePath, 'utf8');
            if (content.length > 10000 && content.includes('Quick Start')) {
                this.addCheck('overall', '✅ Comprehensive README with setup instructions');
            } else {
                this.addCheck('overall', '❌ README lacks comprehensive setup instructions');
            }
        } else {
            this.addCheck('overall', '❌ README.md missing');
        }
        
        // Check frontend integration
        const appPath = path.join(this.projectRoot, 'frontend/src/App.jsx');
        const appContent = this.getFileContent(appPath);
        if (appContent && appContent.includes('SynapseStorage') && appContent.includes('LiveDataDashboard')) {
            this.addCheck('overall', '✅ Frontend integrates all components');
        } else {
            this.addCheck('overall', '❌ Frontend missing component integration');
        }
        
        // Check package.json completeness
        const rootPackagePath = path.join(this.projectRoot, 'package.json');
        if (this.fileExists(rootPackagePath)) {
            this.addCheck('overall', '✅ Root package.json with deployment scripts found');
        } else {
            this.addCheck('overall', '❌ Root package.json missing');
        }
        
        // Check environment configuration
        const envExamplePath = path.join(this.projectRoot, '.env.example');
        if (this.fileExists(envExamplePath)) {
            this.addCheck('overall', '✅ Environment configuration template found');
        } else {
            this.addCheck('overall', '❌ Environment configuration template missing');
        }
    }
    
    /**
     * Helper methods
     */
    fileExists(filePath) {
        return fs.existsSync(filePath);
    }
    
    getFileContent(filePath) {
        try {
            return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
        } catch (error) {
            return null;
        }
    }
    
    addCheck(category, message) {
        this.results[category].checks.push(message);
        if (message.startsWith('✅')) {
            this.results[category].score++;
            this.results.overall.score++;
        }
        console.log(`  ${message}`);
    }
    
    /**
     * Print validation results
     */
    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 VALIDATION RESULTS');
        console.log('='.repeat(60));
        
        // Akave Track Results
        console.log(`\n📦 Akave Track: ${this.results.akave.score}/${this.results.akave.maxScore}`);
        console.log(`   Score: ${Math.round((this.results.akave.score / this.results.akave.maxScore) * 100)}%`);
        
        // Lighthouse Track Results
        console.log(`\n🏠 Lighthouse Track: ${this.results.lighthouse.score}/${this.results.lighthouse.maxScore}`);
        console.log(`   Score: ${Math.round((this.results.lighthouse.score / this.results.lighthouse.maxScore) * 100)}%`);
        
        // Synapse Track Results
        console.log(`\n🔗 Synapse Track: ${this.results.synapse.score}/${this.results.synapse.maxScore}`);
        console.log(`   Score: ${Math.round((this.results.synapse.score / this.results.synapse.maxScore) * 100)}%`);
        
        // Overall Score
        const overallPercentage = Math.round((this.results.overall.score / this.results.overall.maxScore) * 100);
        console.log(`\n🎯 Overall Score: ${this.results.overall.score}/${this.results.overall.maxScore} (${overallPercentage}%)`);
        
        // Status
        if (overallPercentage >= 90) {
            console.log('\n🎉 EXCELLENT! Project meets all hackathon requirements');
        } else if (overallPercentage >= 75) {
            console.log('\n✅ GOOD! Project meets most hackathon requirements');
        } else if (overallPercentage >= 50) {
            console.log('\n⚠️  PARTIAL! Project needs improvement to meet requirements');
        } else {
            console.log('\n❌ INSUFFICIENT! Project does not meet hackathon requirements');
        }
        
        console.log('\n' + '='.repeat(60));
    }
    
    /**
     * Generate detailed validation report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            project: 'ZKVault Protocol',
            version: '1.0.0',
            validation: {
                akave: this.results.akave,
                lighthouse: this.results.lighthouse,
                synapse: this.results.synapse,
                overall: this.results.overall
            },
            summary: {
                totalScore: this.results.overall.score,
                maxScore: this.results.overall.maxScore,
                percentage: Math.round((this.results.overall.score / this.results.overall.maxScore) * 100),
                status: this.getValidationStatus()
            },
            recommendations: this.generateRecommendations()
        };
        
        const reportPath = path.join(this.projectRoot, 'validation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Detailed report saved to: ${reportPath}`);
    }
    
    getValidationStatus() {
        const percentage = Math.round((this.results.overall.score / this.results.overall.maxScore) * 100);
        if (percentage >= 90) return 'EXCELLENT';
        if (percentage >= 75) return 'GOOD';
        if (percentage >= 50) return 'PARTIAL';
        return 'INSUFFICIENT';
    }
    
    generateRecommendations() {
        const recommendations = [];
        
        // Check each category for missing items
        Object.entries(this.results).forEach(([category, data]) => {
            if (category === 'overall') return;
            
            const failedChecks = data.checks.filter(check => check.startsWith('❌'));
            if (failedChecks.length > 0) {
                recommendations.push({
                    category: category.charAt(0).toUpperCase() + category.slice(1),
                    issues: failedChecks.map(check => check.replace('❌ ', '')),
                    priority: failedChecks.length > data.maxScore / 2 ? 'HIGH' : 'MEDIUM'
                });
            }
        });
        
        return recommendations;
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new HackathonValidator();
    validator.validate()
        .then(() => {
            console.log('\n✨ Validation completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Validation failed:', error);
            process.exit(1);
        });
}

module.exports = HackathonValidator;
