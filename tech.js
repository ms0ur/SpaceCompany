Game.tech = (function(){

    var instance = {};

    instance.dataVersion = 2;
    instance.entries = {};
    instance.techTypeCount = 0;
    instance.tabUnlocked = false;

    instance.initialise = function() {
        for(var id in Game.techData) {
            this.entries[id] = Game.techData[id];
            this.techTypeCount++;
            this.entries[id].setId(id);
        }
        console.debug("Loaded " + this.techTypeCount + " Tech Types");
    };

    instance.reset = function() {
        for (var id in Game.techData) {
            var data = this.initTech(id);
            this.entries[id] = data;

            Game.techUI.replaceTech(data);
        }
        refreshResearches();
        console.debug("Loaded " + this.techTypeCount + " Tech Types");
    };

    instance.update = function(delta) {
        if(this.tabUnlocked)
            $('#techTab')[0].className = "";
        for(var id in this.entries){
            var data = this.entries[id];
            if(data.unlocked)
                $('#' + data.htmlId)[0].className = "";
            if(data.current >= data.maxLevel && data.maxLevel > 0)
                $('#' + data.htmlId)[0].className = "hidden";
        }
    };

    instance.save = function(data) {
        data.tech = { v: this.dataVersion, i: {}};
        for(var key in this.entries) {
            data.tech.i[key] = {};
            data.tech.i[key].current = this.entries[key].current;
            data.tech.i[key].unlocked = this.entries[key].unlocked;
        }
    };

    instance.load = function(data) {
        if (data.tech && data.tech.v && data.tech.i) {
            if (data.tech.v >= 2) {
                this.loadV2(data);
            } else if (data.tech.v === 1) {
                this.loadV1(data);
            }
        }
        var tech = Game.tech.getTechData('energyEfficiencyResearch');
        if (tech.current === tech.maxLevel) {
            var child = document.getElementById("energyEffButton");
            if (child !== null) {
                child.parentNode.removeChild(child);
            }
        }
        if(Game.buildings.entries.metalT1.current >= 1){
            if (!Game.tech.tabUnlocked) {
                // Unlock the science resourceCategory
                Game.resourceCategoryData.science.unlocked = true
                // Unlock the science resource
                Game.resources.entries.science.unlocked = true;
                // Unlock scienceT1
                Game.buildings.entries.scienceT1.unlocked = true;
                Game.buildings.entries.scienceT1.displayNeedsUpdate = true;
                // Unlock the research category
                Game.techCategoryData.unlocked = true;
                Game.techCategoryData.research.unlocked = true;
                // Unlock the technology type of research items
                Game.techCategoryData.research.items.technology = true;
                newUnlock('tech');
                Game.notifySuccess('New Tab!', 'You\'ve unlocked the Research Tab!');
                Game.tech.tabUnlocked = true;
            }
        }
    };

    // handle loading a save with dataVersion 1
    instance.loadV1 = function(data) {
        // the new tech data matches the old ids stored in the arrays available and researched
        // anything that was in available before can be considered unlocked
        for (var id in data.available) {
            if (typeof this.entries[data.available[id]] !== 'undefined') {
                this.entries[data.available[id]].unlocked = true;
            }
        }
        // anything that was in researched before can be considered purchased
        for (id in data.researched) {
            if (typeof this.entries[data.researched[id]] !== 'undefined') {
                this.entries[data.researched[id]].current = 1;
            }
        }

        for (id in data.tech.i) {
            if (this.entries[id] && !isNaN(data.tech.i[id]) && data.tech.i[id] > 0) {
                this.gainTech(id, data.tech.i[id]);
                this.entries[id].unlocked = true;
            }
        }
    };

    // handle loading a save with dataVersion 2 or higher
    instance.loadV2 = function(data) {
        for (var id in data.tech.i) {
            if (typeof this.entries[id] !== 'undefined') {
                if (typeof data.tech.i[id].current !== 'undefined' && data.tech.i[id].current > 0) {
                    this.entries[id].current = 0;
                    this.gainTech(id, data.tech.i[id].current);
                    // we can assume that the tech is unlocked if it has been purchased
                    this.entries[id].unlocked = true;
                } else if (typeof data.tech.i[id].unlocked !== 'undefined') {
                    this.entries[id].unlocked = data.tech.i[id].unlocked;
                }
            }
        }
    };

    instance.unlockTech = function(id) {
        var tech = this.getTechData(id);
        if (typeof tech !== 'undefined') {
            tech.unlocked = true;
        }
    };

    // return true if the tech is purchased successfully, false otherwise
    instance.buyTech = function(id, count) {
        var tech = this.getTechData(id);
        if (typeof tech === 'undefined') {
            return false;
        }

        tech.displayNeedsUpdate = true;


        // ensure a valid value for count
        if(isNaN(count) || count === undefined) {
            count = 1;
        }

        // if there's a max level defined then the count may need to be clamped
        if (tech.maxLevel > 0) {
            count = Math.min(tech.maxLevel - tech.current, count);
            if (count <= 0) {
                // the tech is at or above max level, can't buy it
                return false;
            }
        }

        // create a new object for cost to avoid reference issues
        var cost = {};
        if (tech.costType === COST_TYPE.FIXED) {
            if (tech.current > 0 || count > 1) {
                // this calculation could be done more elegantly with math
                for (var resource in tech.cost) {
                    cost[resource] = 0;
                }
                for (var i = 0; i < count; i++) {
                    for (var resource in tech.cost) {
                        cost[resource] += this.getCost(tech.cost[resource], tech.current + i);
                    }
                }
            } else {
                // the predefined base cost can be used
                for (var resource in tech.cost) {
                    cost[resource] = tech.cost[resource];
                }
            }
        } else {
            return false;
        }

        if (!this.hasResources(cost)) {
            return false;
        }

        this.spendResources(cost);
        this.gainTech(id, count);
        return true;
    };

    instance.gainTech = function(id, count) {
        this.removeTechEffect(id);

        if(isNaN(count) || count === undefined) {
            count = 1;
        }

        var newValue = Math.floor(this.entries[id].current + count);
        var finalValue = newValue;
        if(this.entries[id].maxLevel > 0) {
            // There is a max level on this tech, clamp so we don't exceed
            finalValue = Math.min(newValue, this.entries[id].maxLevel)
        }

        this.entries[id].current = finalValue;

        this.applyTechEffect(id);
    };

    instance.removeTech = function(id, count) {
        this.removeTechEffect(id);

        if(isNaN(count) || count === undefined) {
            count = 1;
        }

        // Remove the tech and ensure we can not go below 0
        var newValue = Math.floor(this.entries[id].current - count);
        this.entries[id].current = Math.max(newValue, 0);

        this.applyTechEffect(id);
    };

    instance.updateEfficiencies = function(){
        var techs = ['resourceEfficiencyResearch', 'energyEfficiencyResearch', 'scienceEfficiencyResearch', 'batteryEfficiencyResearch'];
        for(var i = 0; i < techs.length; i++){
            var tech = this.entries[techs[i]];
            if(tech.displayNeedsUpdate){
                if(science_current > tech.cost['science'] || tech.current > 0) {
                    tech.unlocked = true;
                }

                if(Game.resources.entries.science.current > tech.cost['science'] || tech.current > 0) {
                    tech.unlocked = true;
                }

                if(tech.unlocked === false) {
                    tech.getBodyElement().className = 'hidden';
                    return;
                } else {
                    tech.getBodyElement().className= '';
                }

                var cost = this.getCost(tech.cost['science'], tech.current);
                Game.settings.turnRed(science_current, cost, tech.htmlIdCost);
                tech.getTitleElement().innerHTML = tech.name + " #" + (tech.current);
                tech.getCostElement().innerHTML = Game.settings.format(cost);

                if(tech.maxLevel > 0){
                    if(tech.current >= tech.maxLevel && tech.maxLevel > 0) {
                        tech.getButtonElement().className = 'hidden';
                    }

                    if(tech.current === tech.maxLevel) {
                        tech.getTitleElement().innerHTML = tech.name + " " + tech.maxLevel + " (MAX)";
                        tech.getCostElement().innerHTML = "N/A";
                    } else {
                        tech.getTitleElement().innerHTML = tech.name + " " + (tech.current) + " / " + tech.maxLevel;
                        tech.getCostElement().innerHTML = Game.settings.format(cost);
                    }
                }

                tech.displayNeedsUpdate = false;
            }
        }
    };

    instance.getCost = function(basePrice, amount, multiplier) {
        return Math.floor(basePrice * Math.pow(multiplier || 1.1, amount));
    };

    instance.getTechData = function(id) {
        return this.entries[id];
    };

    instance.removeTechEffect = function(id) {
        var data = this.entries[id];
        if(typeof data.remove !== 'undefined') {
            data.remove(data);
        }
    };

    instance.applyTechEffect = function(id) {
        var data = this.entries[id];
        if(typeof data.apply !== 'undefined') {
            data.apply(data);
        }
    };

    instance.hasResources = function (resources) {
        for (var resource in resources) {
            if (Game.resources.entries[resource].current < resources[resource]) {
                return false;
            }
        }
        return true;
    };

    instance.spendResources = function(resources) {
        for (var resource in resources) {
            Game.resources.entries[resource].current -= resources[resource];
        }
    };

    instance.isUnlocked = function(id) {
        var tech = this.getTechData(id);
        if (typeof tech !== 'undefined') {
            return tech.unlocked;
        }
        return false;
    };

    instance.isPurchased = function(id) {
        var tech = this.getTechData(id);
        if (typeof tech !== 'undefined') {
            return tech.current > 0;
        }
        return false;
    };

    instance.isMaxLevel = function(id) {
        var tech = this.getTechData(id);
        if (typeof tech !== 'undefined') {
            if(id == 'energyEfficiencyResearch') return false;
            return tech.maxLevel > 0 && tech.current >= tech.maxLevel;
        }
        return false;
    };

    return instance;
}());