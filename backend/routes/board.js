const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Board = sequelize.define('Board', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  background: {
    type: DataTypes.STRING,
    defaultValue: '#0079BF'
  },
  backgroundType: {
    type: DataTypes.ENUM('color', 'image'),
    defaultValue: 'color'
  },
  visibility: {
    type: DataTypes.ENUM('private', 'public'),
    defaultValue: 'private'
  },
  isStarred: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isClosed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  ownerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'User',
      key: 'id'
    }
  }
});

module.exports = Board;
